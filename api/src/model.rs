use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::de::Error;
use serde::{Deserialize, Deserializer, Serialize};
use std::str::FromStr;

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
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
}
