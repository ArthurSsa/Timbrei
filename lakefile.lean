import Lake
open Lake DSL

package "lemi" where
  version := v!"0.1.0"

require "leanprover-community" / "mathlib" @ git "master"

lean_lib «Lemi» where
  srcDir := "lean"
  roots := #[`FilterParams]
