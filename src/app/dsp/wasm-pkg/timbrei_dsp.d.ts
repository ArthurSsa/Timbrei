/* tslint:disable */
/* eslint-disable */

/**
 * High Shelf. `lemi::BiquadCoeffs::high_shelf`. Uses the slope S in (0, 1].
 * Returns `[b0, b1, b2, a1, a2]`.
 */
export function high_shelf(f0: number, fs: number, s: number, gain_db: number): Float64Array;

/**
 * Low Shelf. `lemi::BiquadCoeffs::low_shelf`. Uses the slope S in (0, 1].
 * Returns `[b0, b1, b2, a1, a2]`.
 */
export function low_shelf(f0: number, fs: number, s: number, gain_db: number): Float64Array;

/**
 * Magnitude in dB of a normalized biquad at ω (rad/sample), using the verified
 * complex response `lemi::frequency::response`.
 * `20·log10|H| = 10·log10(|H|²)`.
 */
export function magnitude_db(b0: number, b1: number, b2: number, a1: number, a2: number, w: number): number;

/**
 * Peaking EQ. `lemi::BiquadCoeffs::peaking`. Uses the quality factor Q.
 * Returns `[b0, b1, b2, a1, a2]`.
 */
export function peaking(f0: number, fs: number, q: number, gain_db: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly high_shelf: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly low_shelf: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly magnitude_db: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly peaking: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
