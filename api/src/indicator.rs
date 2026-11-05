use std::collections::HashSet;

use anyhow::{Result, bail};
use chrono::{Duration, Months, NaiveDate};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::model::{DailySale, Product, Rating, Store};

const DAYS_PER_PERIOD: i64 = 28;
const DAYS_PER_CUSTOMER_PERIOD: i64 = 90;
const MINIMUM_VALID_RATINGS: u32 = 10;
const MAXIMUM_VALID_WAIT_MINUTES: u16 = 120;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AnalysisMetadata {
    pub current_period_start: NaiveDate,
    pub current_period_end: NaiveDate,
    pub previous_period_start: NaiveDate,
    pub previous_period_end: NaiveDate,
    pub latest_data_date: NaiveDate,
}

impl AnalysisMetadata {
    pub fn from_daily_sales(daily_sales: &[DailySale]) -> Result<Self> {
        let latest_data_date = latest_sale_date(daily_sales)?;
        let current_period_start = latest_data_date - Duration::days(DAYS_PER_PERIOD - 1);
        let previous_period_end = current_period_start - Duration::days(1);

        Ok(Self {
            current_period_start,
            current_period_end: latest_data_date,
            previous_period_start: previous_period_end - Duration::days(DAYS_PER_PERIOD - 1),
            previous_period_end,
            latest_data_date,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StoreIndicators {
    pub store_id: String,
    pub intervention_score: u8,
    pub score_reasons: Vec<String>,
    pub days_without_opening: u32,
    pub net_sales_per_calendar_day: Decimal,
    pub net_sales_per_calendar_day_change_pct: Decimal,
    /// Gross discounts granted during the current 28-day inclusive period.
    pub current_period_discounts_amount: Decimal,
    pub ingredient_margin_pct: Decimal,
    pub ingredient_margin_change_percentage_points: Decimal,
    pub net_sales_per_team_hour: Option<Decimal>,
    pub net_sales_per_team_hour_change_pct: Option<Decimal>,
    pub waste_pct_of_net_sales: Option<Decimal>,
    pub average_net_ticket: Option<Decimal>,
    pub valid_rating_count: u32,
    pub average_rating: Option<Decimal>,
    pub median_wait_time_minutes: Option<u16>,
    pub top_selling_products: Vec<TopSellingProduct>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TopSellingProduct {
    pub name: String,
    pub quantity_sold: u32,
    pub estimated_sales: Decimal,
}

#[derive(Default)]
struct SalesTotals {
    net_sales: Decimal,
    discounts: Decimal,
    ingredient_cost: Decimal,
    team_worked_hours: Decimal,
    waste_value: Decimal,
    ticket_count: u32,
}

impl StoreIndicators {
    pub fn from_general_data(
        store: &Store,
        stores: &[Store],
        daily_sales: &[DailySale],
        products: &[Product],
        ratings: &[Rating],
    ) -> Result<Self> {
        let metadata = AnalysisMetadata::from_daily_sales(daily_sales)?;
        let current_start = metadata.current_period_start;
        let period_end = metadata.current_period_end;
        let previous_start = metadata.previous_period_start;
        let previous_end = metadata.previous_period_end;

        let current = sales_totals(daily_sales, &store.store_id, current_start, period_end);
        let previous = sales_totals(daily_sales, &store.store_id, previous_start, previous_end);
        let current_margin = percentage(
            current.net_sales - current.ingredient_cost,
            current.net_sales,
        )?;
        let previous_margin = percentage(
            previous.net_sales - previous.ingredient_cost,
            previous.net_sales,
        )?;
        let current_sales_per_day = current.net_sales / Decimal::from(DAYS_PER_PERIOD);
        let previous_sales_per_day = previous.net_sales / Decimal::from(DAYS_PER_PERIOD);
        let current_sales_per_hour = ratio(current.net_sales, current.team_worked_hours);
        let previous_sales_per_hour = ratio(previous.net_sales, previous.team_worked_hours);
        let (valid_rating_count, average_rating, median_wait_time_minutes) =
            customer_indicators(ratings, &store.store_id, period_end);
        let uses_peer_references = eligible_store_ids(stores, period_end).contains(&store.store_id);
        let score_reasons = intervention_score_reasons(
            stores,
            daily_sales,
            ratings,
            uses_peer_references,
            current_start,
            period_end,
            current_sales_per_day,
            previous_sales_per_day,
            current_margin,
            previous_margin,
            current_sales_per_hour,
            previous_sales_per_hour,
            current.waste_value,
            current.net_sales,
            average_rating,
            median_wait_time_minutes,
        )?;

        Ok(Self {
            store_id: store.store_id.clone(),
            intervention_score: score_reasons.len() as u8,
            score_reasons,
            days_without_opening: days_without_opening(
                daily_sales,
                &store.store_id,
                current_start,
                period_end,
            ),
            net_sales_per_calendar_day: current_sales_per_day,
            net_sales_per_calendar_day_change_pct: percentage_change(
                current_sales_per_day,
                previous_sales_per_day,
            )?,
            current_period_discounts_amount: current.discounts,
            ingredient_margin_pct: current_margin,
            ingredient_margin_change_percentage_points: current_margin - previous_margin,
            net_sales_per_team_hour: current_sales_per_hour,
            net_sales_per_team_hour_change_pct: match (
                current_sales_per_hour,
                previous_sales_per_hour,
            ) {
                (Some(current), Some(previous)) => Some(percentage_change(current, previous)?),
                _ => None,
            },
            waste_pct_of_net_sales: ratio(current.waste_value, current.net_sales)
                .map(|value| value * Decimal::from(100)),
            average_net_ticket: ratio(current.net_sales, Decimal::from(current.ticket_count)),
            valid_rating_count,
            average_rating,
            median_wait_time_minutes,
            top_selling_products: top_selling_products(products, &store.store_id),
        })
    }
}

fn top_selling_products(products: &[Product], store_id: &str) -> Vec<TopSellingProduct> {
    let Some(reference_month) = products
        .iter()
        .filter(|product| same_store(&product.store_id, store_id))
        .map(|product| product.reference_month)
        .max()
    else {
        return Vec::new();
    };

    let mut top_products = products
        .iter()
        .filter(|product| {
            same_store(&product.store_id, store_id) && product.reference_month == reference_month
        })
        .map(|product| TopSellingProduct {
            name: product.name.clone(),
            quantity_sold: product.quantity_sold,
            estimated_sales: product.average_price * Decimal::from(product.quantity_sold),
        })
        .collect::<Vec<_>>();

    top_products.sort_unstable_by(|left, right| {
        right
            .quantity_sold
            .cmp(&left.quantity_sold)
            .then_with(|| left.name.cmp(&right.name))
    });
    top_products.truncate(5);
    top_products
}

#[allow(clippy::too_many_arguments)]
fn intervention_score_reasons(
    stores: &[Store],
    daily_sales: &[DailySale],
    ratings: &[Rating],
    uses_peer_references: bool,
    current_start: NaiveDate,
    period_end: NaiveDate,
    current_sales_per_day: Decimal,
    previous_sales_per_day: Decimal,
    current_margin: Decimal,
    previous_margin: Decimal,
    current_sales_per_hour: Option<Decimal>,
    previous_sales_per_hour: Option<Decimal>,
    current_waste: Decimal,
    current_net_sales: Decimal,
    average_rating: Option<Decimal>,
    median_wait_time_minutes: Option<u16>,
) -> Result<Vec<String>> {
    let mut reasons = Vec::new();

    if percentage_change(current_sales_per_day, previous_sales_per_day)? < Decimal::from(-5) {
        reasons.push("sales_per_day_decline".to_owned());
    }
    if current_margin - previous_margin < Decimal::from(-2) {
        reasons.push("ingredient_margin_decline".to_owned());
    }
    if let (Some(current), Some(previous)) = (current_sales_per_hour, previous_sales_per_hour)
        && percentage_change(current, previous)? < Decimal::from(-5)
    {
        reasons.push("sales_per_team_hour_decline".to_owned());
    }
    if uses_peer_references
        && let (Some(current_waste_pct), Some(waste_threshold)) = (
            ratio(current_waste, current_net_sales),
            network_waste_threshold(stores, daily_sales, current_start, period_end),
        )
        && current_waste_pct >= waste_threshold
    {
        reasons.push("high_waste_vs_network".to_owned());
    }

    let (rating_threshold, wait_threshold) = if uses_peer_references {
        network_customer_thresholds(stores, ratings, period_end)
    } else {
        (None, None)
    };
    let poor_customer_experience = average_rating
        .zip(rating_threshold)
        .is_some_and(|(rating, threshold)| rating <= threshold)
        || median_wait_time_minutes
            .zip(wait_threshold)
            .is_some_and(|(wait, threshold)| wait >= threshold);
    if poor_customer_experience {
        reasons.push("poor_customer_experience_vs_network".to_owned());
    }

    Ok(reasons)
}

fn network_waste_threshold(
    stores: &[Store],
    daily_sales: &[DailySale],
    start: NaiveDate,
    end: NaiveDate,
) -> Option<Decimal> {
    let store_ids = eligible_store_ids(stores, end);
    let mut waste_percentages = store_ids
        .iter()
        .filter_map(|store_id| {
            let totals = sales_totals(daily_sales, store_id, start, end);
            ratio(totals.waste_value, totals.net_sales)
        })
        .collect::<Vec<_>>();

    percentile_decimal(&mut waste_percentages, 3, 4)
}

fn network_customer_thresholds(
    stores: &[Store],
    ratings: &[Rating],
    period_end: NaiveDate,
) -> (Option<Decimal>, Option<u16>) {
    let store_ids = eligible_store_ids(stores, period_end);
    let mut average_ratings = Vec::new();
    let mut median_wait_times = Vec::new();

    for store_id in store_ids {
        let (_, average_rating, median_wait_time) =
            customer_indicators(ratings, &store_id, period_end);
        if let Some(average_rating) = average_rating {
            average_ratings.push(average_rating);
        }
        if let Some(median_wait_time) = median_wait_time {
            median_wait_times.push(median_wait_time);
        }
    }

    (
        percentile_decimal(&mut average_ratings, 1, 4),
        percentile_u16(&mut median_wait_times, 3, 4),
    )
}

fn eligible_store_ids(stores: &[Store], latest_data_date: NaiveDate) -> HashSet<String> {
    let maturity_cutoff = latest_data_date
        .checked_sub_months(Months::new(10))
        .expect("ten-month maturity cutoff must be representable");
    stores
        .iter()
        .filter(|store| store.status && store.opening_date <= maturity_cutoff)
        .map(|store| store.store_id.clone())
        .collect()
}

fn percentile_decimal(
    values: &mut [Decimal],
    numerator: usize,
    denominator: usize,
) -> Option<Decimal> {
    values.sort_unstable();
    percentile_index(values.len(), numerator, denominator).map(|index| values[index])
}

fn percentile_u16(values: &mut [u16], numerator: usize, denominator: usize) -> Option<u16> {
    values.sort_unstable();
    percentile_index(values.len(), numerator, denominator).map(|index| values[index])
}

fn percentile_index(length: usize, numerator: usize, denominator: usize) -> Option<usize> {
    (length > 0).then(|| (length * numerator).div_ceil(denominator).saturating_sub(1))
}

fn latest_sale_date(daily_sales: &[DailySale]) -> Result<NaiveDate> {
    daily_sales
        .iter()
        .map(|sale| sale.date)
        .max()
        .ok_or_else(|| anyhow::anyhow!("não há vendas para calcular indicadores"))
}

fn sales_totals(
    daily_sales: &[DailySale],
    store_id: &str,
    start: NaiveDate,
    end: NaiveDate,
) -> SalesTotals {
    daily_sales
        .iter()
        .filter(|sale| {
            same_store(&sale.id_loja, store_id) && sale.date >= start && sale.date <= end
        })
        .fold(SalesTotals::default(), |mut totals, sale| {
            totals.net_sales += sale.gross_revenue - sale.discounts;
            totals.discounts += sale.discounts;
            totals.ingredient_cost += sale.ingredient_cost;
            totals.team_worked_hours += sale.team_worked_hours;
            totals.waste_value += sale.waste_value;
            totals.ticket_count += sale.ticket_count;
            totals
        })
}

fn days_without_opening(
    daily_sales: &[DailySale],
    store_id: &str,
    start: NaiveDate,
    end: NaiveDate,
) -> u32 {
    let open_days: HashSet<NaiveDate> = daily_sales
        .iter()
        .filter(|sale| {
            same_store(&sale.id_loja, store_id) && sale.date >= start && sale.date <= end
        })
        .map(|sale| sale.date)
        .collect();

    (DAYS_PER_PERIOD as u32).saturating_sub(open_days.len() as u32)
}

fn customer_indicators(
    ratings: &[Rating],
    store_id: &str,
    period_end: NaiveDate,
) -> (u32, Option<Decimal>, Option<u16>) {
    let period_start = period_end - Duration::days(DAYS_PER_CUSTOMER_PERIOD - 1);
    let ratings = ratings.iter().filter(|rating| {
        same_store(&rating.store_id, store_id)
            && rating.date >= period_start
            && rating.date <= period_end
    });

    let scores: Vec<u8> = ratings.clone().filter_map(|rating| rating.score).collect();
    let valid_rating_count = scores.len() as u32;
    let average_rating = (valid_rating_count >= MINIMUM_VALID_RATINGS).then(|| {
        scores.iter().copied().map(Decimal::from).sum::<Decimal>()
            / Decimal::from(valid_rating_count)
    });

    let mut wait_times: Vec<u16> = ratings
        .filter_map(|rating| rating.wait_time_minutes)
        .filter(|wait_time| *wait_time > 0 && *wait_time <= MAXIMUM_VALID_WAIT_MINUTES)
        .collect();
    wait_times.sort_unstable();
    let median_wait_time_minutes =
        (wait_times.len() >= MINIMUM_VALID_RATINGS as usize).then(|| {
            let middle = wait_times.len() / 2;
            if wait_times.len().is_multiple_of(2) {
                (wait_times[middle - 1] + wait_times[middle]) / 2
            } else {
                wait_times[middle]
            }
        });

    (valid_rating_count, average_rating, median_wait_time_minutes)
}

fn ratio(numerator: Decimal, denominator: Decimal) -> Option<Decimal> {
    (!denominator.is_zero()).then(|| numerator / denominator)
}

fn percentage(numerator: Decimal, denominator: Decimal) -> Result<Decimal> {
    ratio(numerator, denominator)
        .map(|value| value * Decimal::from(100))
        .ok_or_else(|| anyhow::anyhow!("não é possível dividir por zero"))
}

fn percentage_change(current: Decimal, previous: Decimal) -> Result<Decimal> {
    if previous.is_zero() {
        bail!("não é possível calcular variação contra período anterior zero")
    }

    Ok((current / previous - Decimal::ONE) * Decimal::from(100))
}

fn same_store(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).unwrap()
    }

    fn sale(date: NaiveDate) -> DailySale {
        DailySale {
            date,
            id_loja: "LJ01".to_owned(),
            gross_revenue: Decimal::from(280),
            discounts: Decimal::ZERO,
            ticket_count: 28,
            team_worked_hours: Decimal::from(28),
            ingredient_cost: Decimal::from(84),
            waste_value: Decimal::from(14),
        }
    }

    #[test]
    fn uses_calendar_days_and_marks_missing_sales_as_closed_days() -> Result<()> {
        let store = Store {
            store_id: "LJ01".to_owned(),
            name: "Teste".to_owned(),
            district: "MG".to_owned(),
            format: "rua".to_owned(),
            model: "propria".to_owned(),
            opening_date: date(2020, 1, 1),
            status: true,
        };
        let sales = vec![sale(date(2026, 6, 2)), sale(date(2026, 6, 30))];
        let products = vec![
            Product {
                store_id: "LJ01".to_owned(),
                reference_month: date(2026, 5, 1),
                name: "Produto antigo".to_owned(),
                quantity_sold: 9_999,
                average_price: Decimal::ONE,
                unit_cost: None,
            },
            Product {
                store_id: "lj01".to_owned(),
                reference_month: date(2026, 6, 1),
                name: "Café".to_owned(),
                quantity_sold: 20,
                average_price: Decimal::from(10),
                unit_cost: None,
            },
        ];
        let ratings = (0..10)
            .map(|index| Rating {
                rating_id: index.to_string(),
                store_id: "LJ01".to_owned(),
                date: date(2026, 6, 30),
                score: Some(4),
                channel: "app".to_owned(),
                wait_time_minutes: Some(15),
                comment: None,
            })
            .collect::<Vec<_>>();

        let indicators = StoreIndicators::from_general_data(
            &store,
            &[store.clone()],
            &sales,
            &products,
            &ratings,
        )?;

        assert_eq!(indicators.intervention_score, 2);
        assert_eq!(indicators.days_without_opening, 27);
        assert_eq!(indicators.net_sales_per_calendar_day, Decimal::from(10));
        assert_eq!(indicators.current_period_discounts_amount, Decimal::ZERO);
        assert_eq!(indicators.ingredient_margin_pct, Decimal::from(70));
        assert_eq!(indicators.waste_pct_of_net_sales, Some(Decimal::from(5)));
        assert_eq!(indicators.average_rating, Some(Decimal::from(4)));
        assert_eq!(indicators.median_wait_time_minutes, Some(15));
        assert_eq!(
            indicators.top_selling_products,
            vec![TopSellingProduct {
                name: "Café".to_owned(),
                quantity_sold: 20,
                estimated_sales: Decimal::from(200),
            }]
        );
        assert!(
            serde_json::to_value(&indicators)?
                .get("current_period_discounts_amount")
                .is_some()
        );

        Ok(())
    }

    #[test]
    fn metadata_exposes_exact_inclusive_28_day_periods() -> Result<()> {
        let metadata = AnalysisMetadata::from_daily_sales(&[sale(date(2026, 6, 30))])?;

        assert_eq!(metadata.current_period_start, date(2026, 6, 3));
        assert_eq!(metadata.current_period_end, date(2026, 6, 30));
        assert_eq!(metadata.previous_period_start, date(2026, 5, 6));
        assert_eq!(metadata.previous_period_end, date(2026, 6, 2));
        assert_eq!(metadata.latest_data_date, date(2026, 6, 30));
        assert_eq!(
            serde_json::to_value(&metadata)?["current_period_start"],
            "2026-06-03"
        );

        Ok(())
    }

    #[test]
    fn sums_discounts_in_the_current_period() -> Result<()> {
        let store = Store {
            store_id: "LJ01".to_owned(),
            name: "Teste".to_owned(),
            district: "MG".to_owned(),
            format: "rua".to_owned(),
            model: "propria".to_owned(),
            opening_date: date(2020, 1, 1),
            status: true,
        };
        let mut current_sale = sale(date(2026, 6, 30));
        current_sale.discounts = Decimal::from(25);

        let indicators = StoreIndicators::from_general_data(
            &store,
            &[store.clone()],
            &[sale(date(2026, 5, 6)), current_sale],
            &[],
            &[],
        )?;

        assert_eq!(
            indicators.current_period_discounts_amount,
            Decimal::from(25)
        );
        Ok(())
    }

    #[test]
    fn excludes_recent_stores_from_network_references() {
        let mature = Store {
            store_id: "LJ01".to_owned(),
            name: "Madura".to_owned(),
            district: "Belo Horizonte/MG".to_owned(),
            format: "Rua".to_owned(),
            model: "Própria".to_owned(),
            opening_date: date(2025, 8, 30),
            status: true,
        };
        let recent = Store {
            store_id: "LJ02".to_owned(),
            opening_date: date(2025, 9, 1),
            ..mature.clone()
        };
        let inactive = Store {
            store_id: "LJ03".to_owned(),
            status: false,
            ..mature.clone()
        };

        assert_eq!(
            eligible_store_ids(&[mature, recent, inactive], date(2026, 6, 30)),
            HashSet::from(["LJ01".to_owned()])
        );
    }

    #[test]
    fn recent_stores_do_not_receive_peer_relative_score_reasons() -> Result<()> {
        let reasons = intervention_score_reasons(
            &[],
            &[],
            &[],
            false,
            date(2026, 6, 3),
            date(2026, 6, 30),
            Decimal::from(100),
            Decimal::from(100),
            Decimal::from(70),
            Decimal::from(70),
            Some(Decimal::from(100)),
            Some(Decimal::from(100)),
            Decimal::from(10),
            Decimal::from(100),
            Some(Decimal::ONE),
            Some(120),
        )?;

        assert!(reasons.is_empty());
        Ok(())
    }

    #[test]
    fn exposes_each_triggered_score_reason() -> Result<()> {
        let stores = vec![Store {
            store_id: "LJ01".to_owned(),
            name: "Teste".to_owned(),
            district: "Belo Horizonte/MG".to_owned(),
            format: "Rua".to_owned(),
            model: "Própria".to_owned(),
            opening_date: date(2020, 1, 1),
            status: true,
        }];
        let mut sales = Vec::new();
        for day in 0..56 {
            let mut entry = sale(date(2026, 5, 6) + Duration::days(day));
            if day >= 28 {
                entry.gross_revenue = Decimal::from(50);
            }
            sales.push(entry);
        }
        let ratings = (0..10)
            .map(|index| Rating {
                rating_id: index.to_string(),
                store_id: "LJ01".to_owned(),
                date: date(2026, 6, 30),
                score: Some(1),
                channel: "app".to_owned(),
                wait_time_minutes: Some(120),
                comment: None,
            })
            .collect::<Vec<_>>();

        let indicators =
            StoreIndicators::from_general_data(&stores[0], &stores, &sales, &[], &ratings)?;

        assert_eq!(indicators.intervention_score, 5);
        assert_eq!(
            indicators.score_reasons,
            vec![
                "sales_per_day_decline",
                "ingredient_margin_decline",
                "sales_per_team_hour_decline",
                "high_waste_vs_network",
                "poor_customer_experience_vs_network",
            ]
        );
        Ok(())
    }
}
