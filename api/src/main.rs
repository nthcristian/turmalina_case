use std::{fs::File, path::PathBuf, sync::Arc};

use anyhow::Result;
use api::{
    indicator::{AnalysisMetadata, StoreIndicators},
    model::{DailySale, DataQuality, Product, Rating, Store, normalize_loaded_data},
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use chrono::{Duration, NaiveDate};
use csv::Reader;
use rust_decimal::Decimal;
use serde::Serialize;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    stores: Arc<Vec<Store>>,
    indicators: Arc<Vec<StoreIndicators>>,
    data_quality: Arc<DataQuality>,
    daily_sales: Arc<Vec<DailySale>>,
    metadata: Arc<AnalysisMetadata>,
}

#[derive(Serialize)]
struct DailySalesPoint {
    date: NaiveDate,
    net_sales: Decimal,
}

fn get_csv_reader(table_name: &str) -> Result<Reader<File>> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!("../data/{table_name}.csv"));
    Ok(csv::Reader::from_path(path)?)
}

async fn list_stores(State(state): State<AppState>) -> Json<Vec<Store>> {
    Json(state.stores.as_ref().clone())
}

async fn get_store(
    State(state): State<AppState>,
    Path(store_id): Path<String>,
) -> Result<Json<Store>, StatusCode> {
    state
        .stores
        .iter()
        .find(|store| store.store_id.eq_ignore_ascii_case(&store_id))
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn list_indicators(State(state): State<AppState>) -> Json<Vec<StoreIndicators>> {
    Json(state.indicators.as_ref().clone())
}

async fn get_data_quality(State(state): State<AppState>) -> Json<DataQuality> {
    Json(state.data_quality.as_ref().clone())
}

async fn get_metadata(State(state): State<AppState>) -> Json<AnalysisMetadata> {
    Json(state.metadata.as_ref().clone())
}

async fn get_store_indicators(
    State(state): State<AppState>,
    Path(store_id): Path<String>,
) -> Result<Json<StoreIndicators>, StatusCode> {
    state
        .indicators
        .iter()
        .find(|indicator| indicator.store_id.eq_ignore_ascii_case(&store_id))
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn get_store_sales(
    State(state): State<AppState>,
    Path(store_id): Path<String>,
) -> Result<Json<Vec<DailySalesPoint>>, StatusCode> {
    if !state
        .stores
        .iter()
        .any(|store| store.store_id.eq_ignore_ascii_case(&store_id))
    {
        return Err(StatusCode::NOT_FOUND);
    }

    let period_end = state
        .daily_sales
        .iter()
        .map(|sale| sale.date)
        .max()
        .ok_or(StatusCode::NOT_FOUND)?;
    let points = (0..56)
        .rev()
        .map(|offset| {
            let date = period_end - Duration::days(offset);
            let net_sales = state
                .daily_sales
                .iter()
                .filter(|sale| sale.id_loja.eq_ignore_ascii_case(&store_id) && sale.date == date)
                .map(|sale| sale.gross_revenue - sale.discounts)
                .sum();
            DailySalesPoint { date, net_sales }
        })
        .collect();

    Ok(Json(points))
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut stores_reader = get_csv_reader("turmalina_lojas")?;
    let mut stores: Vec<Store> = stores_reader.deserialize().collect::<Result<_, _>>()?;

    let mut products_reader = get_csv_reader("turmalina_itens")?;
    let mut products: Vec<Product> = products_reader.deserialize().collect::<Result<_, _>>()?;

    let mut ratings_reader = get_csv_reader("turmalina_avaliacoes")?;
    let mut ratings: Vec<Rating> = ratings_reader.deserialize().collect::<Result<_, _>>()?;

    let mut sales_reader = get_csv_reader("turmalina_vendas_diarias")?;
    let mut daily_sales: Vec<DailySale> = sales_reader.deserialize().collect::<Result<_, _>>()?;
    let data_quality =
        normalize_loaded_data(&mut stores, &mut daily_sales, &mut products, &mut ratings);
    let metadata = AnalysisMetadata::from_daily_sales(&daily_sales)?;

    let mut indicators = stores
        .iter()
        .filter(|store| store.status)
        .map(|store| {
            StoreIndicators::from_general_data(store, &stores, &daily_sales, &products, &ratings)
        })
        .collect::<Result<Vec<_>>>()?;
    indicators.sort_unstable_by(|left, right| {
        right
            .intervention_score
            .cmp(&left.intervention_score)
            .then_with(|| {
                left.net_sales_per_calendar_day_change_pct
                    .cmp(&right.net_sales_per_calendar_day_change_pct)
            })
    });

    let state = AppState {
        stores: Arc::new(stores),
        indicators: Arc::new(indicators),
        data_quality: Arc::new(data_quality),
        daily_sales: Arc::new(daily_sales),
        metadata: Arc::new(metadata),
    };
    let app = Router::new()
        .route("/api/stores", get(list_stores))
        .route("/api/stores/{store_id}", get(get_store))
        .route("/api/indicators", get(list_indicators))
        .route("/api/data-quality", get(get_data_quality))
        .route("/api/metadata", get(get_metadata))
        .route(
            "/api/stores/{store_id}/indicators",
            get(get_store_indicators),
        )
        .route("/api/stores/{store_id}/sales", get(get_store_sales))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:3000").await?;
    println!("Listening at http://127.0.0.1:3000");
    axum::serve(listener, app).await?;

    Ok(())
}
