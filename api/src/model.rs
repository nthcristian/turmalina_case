use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::de::Error;
use serde::{Deserialize, Deserializer, Serialize};
use std::{collections::HashSet, str::FromStr};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DailySale {
    #[serde(rename = "data", deserialize_with = "deserialize_date")]
    pub date: NaiveDate,
    #[serde(rename = "id_loja")]
    pub id_loja: String,
    #[serde(rename = "faturamento_bruto")]
    pub gross_revenue: Decimal,
    #[serde(rename = "descontos")]
    pub discounts: Decimal,
    #[serde(rename = "num_tickets")]
    pub ticket_count: u32,
    #[serde(rename = "horas_trabalhadas_equipe")]
    pub team_worked_hours: Decimal,
    #[serde(rename = "custo_insumos")]
    pub ingredient_cost: Decimal,
    #[serde(rename = "valor_desperdicio")]
    pub waste_value: Decimal,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Store {
    #[serde(rename = "id_loja")]
    pub store_id: String,
    #[serde(rename = "nome_loja")]
    pub name: String,
    #[serde(rename = "cidade_uf")]
    pub district: String,
    #[serde(rename = "formato")]
    pub format: String,
    #[serde(rename = "modelo")]
    pub model: String,
    #[serde(rename = "data_abertura", deserialize_with = "deserialize_date")]
    pub opening_date: NaiveDate,
    #[serde(rename = "status", deserialize_with = "deserialize_status")]
    pub status: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Product {
    #[serde(rename = "id_loja")]
    pub store_id: String,
    #[serde(rename = "competencia", deserialize_with = "deserialize_year_month")]
    pub reference_month: NaiveDate,
    #[serde(rename = "produto")]
    pub name: String,
    #[serde(rename = "quantidade_vendida")]
    pub quantity_sold: u32,
    #[serde(rename = "preco_medio", deserialize_with = "deserialize_brl_decimal")]
    pub average_price: Decimal,
    #[serde(rename = "custo_unitario")]
    pub unit_cost: Option<Decimal>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Rating {
    #[serde(rename = "id_avaliacao")]
    pub rating_id: String,
    #[serde(rename = "id_loja")]
    pub store_id: String,
    #[serde(rename = "data", deserialize_with = "deserialize_date")]
    pub date: NaiveDate,
    #[serde(rename = "nota", deserialize_with = "deserialize_rating_score")]
    pub score: Option<u8>,
    #[serde(rename = "canal")]
    pub channel: String,
    #[serde(rename = "tempo_espera_min")]
    pub wait_time_minutes: Option<u16>,
    #[serde(rename = "comentario")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct DataQuality {
    pub duplicate_daily_sales: u32,
    pub invalid_ratings: u32,
    pub implausible_wait_times: u32,
    pub missing_unit_costs: u32,
}

pub fn normalize_loaded_data(
    stores: &mut [Store],
    daily_sales: &mut Vec<DailySale>,
    products: &mut [Product],
    ratings: &mut [Rating],
) -> DataQuality {
    for store in stores {
        store.store_id = normalize_store_id(&store.store_id);
        store.district = normalize_district(&store.district);
        store.format = normalize_format(&store.format);
        store.model = normalize_model(&store.model);
    }
    for product in products.iter_mut() {
        product.store_id = normalize_store_id(&product.store_id);
    }
    for rating in ratings.iter_mut() {
        rating.store_id = normalize_store_id(&rating.store_id);
    }

    let mut quality = DataQuality {
        invalid_ratings: ratings
            .iter()
            .filter(|rating| rating.score.is_none())
            .count() as u32,
        implausible_wait_times: ratings
            .iter()
            .filter(|rating| {
                rating
                    .wait_time_minutes
                    .is_some_and(|wait_time| wait_time == 0 || wait_time > 120)
            })
            .count() as u32,
        missing_unit_costs: products
            .iter()
            .filter(|product| product.unit_cost.is_none())
            .count() as u32,
        ..DataQuality::default()
    };
    let mut seen = HashSet::new();
    daily_sales.retain_mut(|sale| {
        sale.id_loja = normalize_store_id(&sale.id_loja);
        if seen.insert((sale.id_loja.clone(), sale.date)) {
            true
        } else {
            quality.duplicate_daily_sales += 1;
            false
        }
    });
    quality
}

fn normalize_store_id(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

fn normalize_district(value: &str) -> String {
    let normalized = value
        .trim()
        .to_lowercase()
        .replace(['/', '-', '(', ')'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    match normalized.as_str() {
        "bh" | "bh mg" | "belo horizonte mg" => "Belo Horizonte/MG".to_owned(),
        "contagem mg" => "Contagem/MG".to_owned(),
        "nova lima mg" => "Nova Lima/MG".to_owned(),
        "juiz de fora mg" => "Juiz de Fora/MG".to_owned(),
        "vitoria es" | "vitória es" => "Vitória/ES".to_owned(),
        "campinas sp" => "Campinas/SP".to_owned(),
        "uberlandia mg" | "uberlândia mg" => "Uberlândia/MG".to_owned(),
        "sao paulo sp" | "são paulo sp" => "São Paulo/SP".to_owned(),
        _ => value.trim().to_owned(),
    }
}

fn normalize_format(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "rua" | "loja de rua" => "Rua".to_owned(),
        "shopping" | "shopping center" => "Shopping".to_owned(),
        "quiosque" | "kiosk" => "Quiosque".to_owned(),
        _ => value.trim().to_owned(),
    }
}

fn normalize_model(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "propria" | "própria" => "Própria".to_owned(),
        "franquia" => "Franquia".to_owned(),
        _ => value.trim().to_owned(),
    }
}

const DATE_FORMATS: [&str; 3] = ["%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y"];

fn deserialize_date<'de, D>(deserializer: D) -> Result<NaiveDate, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;

    DATE_FORMATS
        .iter()
        .find_map(|format| NaiveDate::parse_from_str(&value, format).ok())
        .ok_or_else(|| D::Error::custom(format!("data inválida: {value}")))
}

fn deserialize_year_month<'de, D>(deserializer: D) -> Result<NaiveDate, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    NaiveDate::parse_from_str(&format!("{value}-01"), "%Y-%m-%d")
        .map_err(|_| D::Error::custom(format!("mês de competência inválido: {value}")))
}

fn deserialize_brl_decimal<'de, D>(deserializer: D) -> Result<Decimal, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    let value = value.trim().trim_start_matches("R$").trim();
    let normalized = if value.contains(',') {
        value.replace('.', "").replace(',', ".")
    } else {
        value.to_owned()
    };

    Decimal::from_str(&normalized)
        .map_err(|_| D::Error::custom(format!("valor monetário inválido: {value}")))
}

fn deserialize_rating_score<'de, D>(deserializer: D) -> Result<Option<u8>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    let normalized = value.trim().to_lowercase();
    let score = match normalized.as_str() {
        "1" | "1,0" | "1.0" | "um" | "uma" | "1 estrela" | "1 estrelas" => Some(1),
        "2" | "2,0" | "2.0" | "dois" | "duas" | "2 estrelas" => Some(2),
        "3" | "3,0" | "3.0" | "três" | "3 estrelas" => Some(3),
        "4" | "4,0" | "4.0" | "quatro" | "4 estrelas" => Some(4),
        "5" | "5,0" | "5.0" | "cinco" | "5 estrelas" => Some(5),
        _ => None,
    };

    Ok(score)
}

fn deserialize_status<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    let normalized = value.trim().to_lowercase();

    match normalized.as_str() {
        "ativa" | "1" => Ok(true),
        "inativa" | "0" => Ok(false),
        _ => Err(D::Error::custom(format!("status inválido: {value}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::{Ok, Result};
    use csv::Reader;
    use std::{fs::File, path::PathBuf};

    fn get_csv_reader(table_name: &str) -> Result<Reader<File>> {
        let path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!("../data/{}.csv", table_name));
        Ok(csv::Reader::from_path(path)?)
    }

    #[test]
    fn parses_sales_csv() -> Result<()> {
        let mut reader = get_csv_reader("turmalina_vendas_diarias")?;
        let sales: Vec<DailySale> = reader.deserialize().collect::<Result<_, _>>()?;

        assert_eq!(sales.len(), 4_127);

        let first = sales.first().expect("the sales CSV must contain records");
        assert_eq!(first.id_loja, "LJ01");
        assert_eq!(first.date, NaiveDate::from_ymd_opt(2025, 7, 1).unwrap());
        assert_eq!(first.gross_revenue, Decimal::new(893_694, 2));

        Ok(())
    }

    #[test]
    fn parse_store_csv() -> Result<()> {
        let mut reader = get_csv_reader("turmalina_lojas")?;
        let stores: Vec<Store> = reader.deserialize().collect::<Result<_, _>>()?;

        let first = stores.first().expect("the stores CSV must contain records");
        assert_eq!(first.store_id, "LJ01");
        assert_eq!(stores.len(), 14);
        assert_eq!(
            stores[1].opening_date,
            NaiveDate::from_ymd_opt(2021, 11, 5).unwrap()
        );
        assert_eq!(
            stores[2].opening_date,
            NaiveDate::from_ymd_opt(2022, 3, 21).unwrap()
        );

        Ok(())
    }

    #[test]
    fn parse_items_csv() -> Result<()> {
        let mut reader = get_csv_reader("turmalina_itens")?;
        let products: Vec<Product> = reader.deserialize().collect::<Result<_, _>>()?;

        let first = products
            .first()
            .expect("the items CSV must contain records");
        assert_eq!(first.store_id, "LJ01");
        assert_eq!(
            first.reference_month,
            NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()
        );
        assert_eq!(first.quantity_sold, 1_411);
        assert_eq!(first.average_price, Decimal::new(857, 2));
        assert_eq!(first.unit_cost, Some(Decimal::new(162, 2)));

        Ok(())
    }

    #[test]
    fn parse_ratings_csv() -> Result<()> {
        let mut reader = get_csv_reader("turmalina_avaliacoes")?;
        let ratings: Vec<Rating> = reader.deserialize().collect::<Result<_, _>>()?;

        let first = ratings
            .first()
            .expect("the ratings CSV must contain records");
        assert_eq!(first.store_id, "LJ01");
        assert_eq!(first.score, Some(4));
        assert_eq!(first.wait_time_minutes, Some(999));
        assert_eq!(ratings.len(), 380);

        Ok(())
    }

    #[test]
    fn normalizes_dimensions_and_reports_data_quality() {
        let mut stores = vec![Store {
            store_id: " lj01 ".to_owned(),
            name: "Teste".to_owned(),
            district: "bh/mg".to_owned(),
            format: "Loja de rua".to_owned(),
            model: "propria".to_owned(),
            opening_date: NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
            status: true,
        }];
        let first_sale = DailySale {
            date: NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
            id_loja: "lj01".to_owned(),
            gross_revenue: Decimal::from(100),
            discounts: Decimal::ZERO,
            ticket_count: 1,
            team_worked_hours: Decimal::ONE,
            ingredient_cost: Decimal::ONE,
            waste_value: Decimal::ZERO,
        };
        let mut sales = vec![
            first_sale.clone(),
            DailySale {
                id_loja: " LJ01 ".to_owned(),
                ..first_sale
            },
        ];
        let mut products = vec![Product {
            store_id: "lj01".to_owned(),
            reference_month: NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
            name: "Café".to_owned(),
            quantity_sold: 1,
            average_price: Decimal::ONE,
            unit_cost: None,
        }];
        let mut ratings = vec![Rating {
            rating_id: "1".to_owned(),
            store_id: "lj01".to_owned(),
            date: NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
            score: None,
            channel: "app".to_owned(),
            wait_time_minutes: Some(999),
            comment: None,
        }];

        let quality = normalize_loaded_data(&mut stores, &mut sales, &mut products, &mut ratings);

        assert_eq!(stores[0].store_id, "LJ01");
        assert_eq!(stores[0].district, "Belo Horizonte/MG");
        assert_eq!(stores[0].format, "Rua");
        assert_eq!(stores[0].model, "Própria");
        assert_eq!(sales.len(), 1);
        assert_eq!(sales[0].id_loja, "LJ01");
        assert_eq!(
            quality,
            DataQuality {
                duplicate_daily_sales: 1,
                invalid_ratings: 1,
                implausible_wait_times: 1,
                missing_unit_costs: 1,
            }
        );
    }
}
