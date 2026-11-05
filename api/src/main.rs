use std::{fs::File, path::PathBuf, sync::Arc};

use anyhow::Result;
use api::{
    indicator::StoreIndicators,
    model::{DailySale, Product, Rating, Store},
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use csv::Reader;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    stores: Arc<Vec<Store>>,
    indicators: Arc<Vec<StoreIndicators>>,
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

#[tokio::main]
async fn main() -> Result<()> {
    let mut stores_reader = get_csv_reader("turmalina_lojas")?;
    let stores: Vec<Store> = stores_reader.deserialize().collect::<Result<_, _>>()?;

    let mut products_reader = get_csv_reader("turmalina_itens")?;
    let products: Vec<Product> = products_reader.deserialize().collect::<Result<_, _>>()?;

    let mut ratings_reader = get_csv_reader("turmalina_avaliacoes")?;
    let ratings: Vec<Rating> = ratings_reader.deserialize().collect::<Result<_, _>>()?;

    let mut sales_reader = get_csv_reader("turmalina_vendas_diarias")?;
    let daily_sales: Vec<DailySale> = sales_reader.deserialize().collect::<Result<_, _>>()?;

    let mut indicators = stores
        .iter()
        .filter(|store| store.status)
        .map(|store| StoreIndicators::from_general_data(store, &daily_sales, &products, &ratings))
        .collect::<Result<Vec<_>>>()?;
    indicators.sort_unstable_by(|left, right| {
        right
            .intervention_score
            .cmp(&left.intervention_score)
            .then_with(|| {
                left.net_sales_per_calendar_day
                    .cmp(&right.net_sales_per_calendar_day)
            })
    });

    let state = AppState {
        stores: Arc::new(stores),
        indicators: Arc::new(indicators),
    };
    let app = Router::new()
        .route("/api/stores", get(list_stores))
        .route("/api/stores/{store_id}", get(get_store))
        .route("/api/indicators", get(list_indicators))
        .route(
            "/api/stores/{store_id}/indicators",
            get(get_store_indicators),
        )
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:3000").await?;
    println!("Listening at http://127.0.0.1:3000");
    axum::serve(listener, app).await?;

    Ok(())
}
