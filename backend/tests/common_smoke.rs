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

#[test]
fn assert_coeffs_within_ulp_passes_for_equal() {
    let a = (1.0, 2.0, 3.0, 4.0, 5.0);
    let b = (1.0, 2.0, 3.0, 4.0, 5.0);
    common::assert_coeffs_within_ulp("smoke", a, b, 0);
}

#[test]
#[should_panic(expected = "exceeded 0 ULP")]
fn assert_coeffs_within_ulp_panics_for_one_ulp_off() {
    let a: (f64, f64, f64, f64, f64) = (1.0, 2.0, 3.0, 4.0, 5.0);
    let b0_off = f64::from_bits(a.0.to_bits() + 1);
    let b = (b0_off, 2.0, 3.0, 4.0, 5.0);
    common::assert_coeffs_within_ulp("smoke", a, b, 0);
}
