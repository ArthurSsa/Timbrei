mod common;

#[test]
fn smoke_zero_distance() {
    assert_eq!(common::ulp_distance(1.0, 1.0), 0);
}

#[test]
fn smoke_one_ulp() {
    let a = 1.0_f64;
    let b = f64::from_bits(a.to_bits() + 1);
    assert_eq!(common::ulp_distance(a, b), 1);
}

#[test]
fn smoke_signed_zero() {
    assert_eq!(common::ulp_distance(0.0, -0.0), 0);
}

#[test]
#[should_panic(expected = "NaN input")]
fn smoke_nan_panics() {
    let _ = common::ulp_distance(f64::NAN, 1.0);
}
