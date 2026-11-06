use std::collections::{HashMap, HashSet};

use anyhow::Result;
use chrono::{Months, NaiveDate};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::model::Product;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProductComparison {
    pub name: String,
    pub current_quantity_sold: u32,
    pub previous_quantity_sold: Option<u32>,
    pub quantity_change_pct: Option<Decimal>,
    pub current_average_price: Decimal,
    pub previous_average_price: Option<Decimal>,
    pub price_change_pct: Option<Decimal>,
    pub current_estimated_sales: Decimal,
    pub previous_estimated_sales: Option<Decimal>,
    pub estimated_sales_change_pct: Option<Decimal>,
    pub is_new_in_current_month: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProductMissingFromCurrentMonth {
    pub name: String,
    pub previous_quantity_sold: u32,
    pub previous_average_price: Decimal,
    pub previous_estimated_sales: Decimal,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StoreProductAnalysis {
    pub store_id: String,
    pub current_reference_month: NaiveDate,
    pub previous_reference_month: NaiveDate,
    pub top_selling_products: Vec<ProductComparison>,
    pub least_selling_products: Vec<ProductComparison>,
    pub products: Vec<ProductComparison>,
    pub missing_from_current_month: Vec<ProductMissingFromCurrentMonth>,
}

pub fn analyze_store_products(products: &[Product], store_id: &str) -> Result<Option<StoreProductAnalysis>> {
    let Some(current_reference_month) = products
        .iter()
        .filter(|product| product.store_id.eq_ignore_ascii_case(store_id))
        .map(|product| product.reference_month)
        .max()
    else {
        return Ok(None);
    };
    let previous_reference_month = current_reference_month
        .checked_sub_months(Months::new(1))
        .expect("previous month must be representable");
    let current_products = products
        .iter()
        .filter(|product| {
            product.store_id.eq_ignore_ascii_case(store_id)
                && product.reference_month == current_reference_month
        })
        .collect::<Vec<_>>();
    let previous_products = products
        .iter()
        .filter(|product| {
            product.store_id.eq_ignore_ascii_case(store_id)
                && product.reference_month == previous_reference_month
        })
        .collect::<Vec<_>>();
    let previous_by_name = previous_products
        .iter()
        .map(|product| (product.name.as_str(), *product))
        .collect::<HashMap<_, _>>();
    let current_names = current_products
        .iter()
        .map(|product| product.name.as_str())
        .collect::<HashSet<_>>();
    let mut comparisons = current_products
        .into_iter()
        .map(|product| comparison(product, previous_by_name.get(product.name.as_str()).copied()))
        .collect::<Vec<_>>();
    comparisons.sort_unstable_by(|left, right| {
        right
            .current_quantity_sold
            .cmp(&left.current_quantity_sold)
            .then_with(|| left.name.cmp(&right.name))
    });
    let top_selling_products = comparisons.iter().take(5).cloned().collect();
    let least_selling_products = comparisons.iter().rev().take(5).cloned().collect();
    let missing_from_current_month = previous_products
        .into_iter()
        .filter(|product| !current_names.contains(product.name.as_str()))
        .map(|product| ProductMissingFromCurrentMonth {
            name: product.name.clone(),
            previous_quantity_sold: product.quantity_sold,
            previous_average_price: product.average_price,
            previous_estimated_sales: estimated_sales(product),
        })
        .collect();

    Ok(Some(StoreProductAnalysis {
        store_id: store_id.to_ascii_uppercase(),
        current_reference_month,
        previous_reference_month,
        top_selling_products,
        least_selling_products,
        products: comparisons,
        missing_from_current_month,
    }))
}

fn comparison(current: &Product, previous: Option<&Product>) -> ProductComparison {
    let previous_estimated_sales = previous.map(estimated_sales);

    ProductComparison {
        name: current.name.clone(),
        current_quantity_sold: current.quantity_sold,
        previous_quantity_sold: previous.map(|product| product.quantity_sold),
        quantity_change_pct: previous.and_then(|product| percent_change(current.quantity_sold.into(), product.quantity_sold.into())),
        current_average_price: current.average_price,
        previous_average_price: previous.map(|product| product.average_price),
        price_change_pct: previous.and_then(|product| percent_change(current.average_price, product.average_price)),
        current_estimated_sales: estimated_sales(current),
        previous_estimated_sales,
        estimated_sales_change_pct: previous_estimated_sales.and_then(|sales| percent_change(estimated_sales(current), sales)),
        is_new_in_current_month: previous.is_none(),
    }
}

fn estimated_sales(product: &Product) -> Decimal {
    product.average_price * Decimal::from(product.quantity_sold)
}

fn percent_change(current: Decimal, previous: Decimal) -> Option<Decimal> {
    (!previous.is_zero()).then(|| (current / previous - Decimal::ONE) * Decimal::from(100))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn product(month: u32, name: &str, quantity_sold: u32, average_price: i64) -> Product {
        Product {
            store_id: "LJ01".to_owned(),
            reference_month: NaiveDate::from_ymd_opt(2026, month, 1).unwrap(),
            name: name.to_owned(),
            quantity_sold,
            average_price: Decimal::from(average_price),
            unit_cost: None,
        }
    }

    #[test]
    fn compares_current_and_previous_month_without_using_unit_cost() -> Result<()> {
        let products = vec![
            product(5, "Espresso", 8, 3),
            product(5, "Bolo", 10, 8),
            product(5, "Ausente", 2, 6),
            product(6, "Espresso", 10, 4),
            product(6, "Bolo", 5, 8),
            product(6, "Novo", 7, 3),
        ];

        let analysis = analyze_store_products(&products, "lj01")?.unwrap();

        assert_eq!(analysis.current_reference_month, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap());
        assert_eq!(analysis.previous_reference_month, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap());
        assert_eq!(analysis.top_selling_products[0].name, "Espresso");
        assert_eq!(analysis.least_selling_products[0].name, "Bolo");
        assert_eq!(analysis.top_selling_products[0].quantity_change_pct, Some(Decimal::from(25)));
        assert!(analysis.products.iter().find(|product| product.name == "Novo").unwrap().is_new_in_current_month);
        assert_eq!(analysis.missing_from_current_month[0].name, "Ausente");

        Ok(())
    }

    #[test]
    fn returns_none_when_store_has_no_products() -> Result<()> {
        assert!(analyze_store_products(&[], "LJ99")?.is_none());
        Ok(())
    }
}
