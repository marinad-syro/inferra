-- Add formula_type column to derived_variables table
-- This enables support for different types of formulas:
-- 'eval': Simple numeric operations using pandas.eval()
-- 'transform': Advanced transformations (type conversions, normalization, composite scores)
-- 'python': Future support for sandboxed Python execution

ALTER TABLE public.derived_variables
ADD COLUMN formula_type TEXT DEFAULT 'eval' CHECK (formula_type IN ('eval', 'transform', 'python'));

-- Add index for better query performance
CREATE INDEX idx_derived_variables_formula_type ON public.derived_variables(formula_type);

-- Add comment for documentation
COMMENT ON COLUMN public.derived_variables.formula_type IS 'Type of formula: eval (numeric operations), transform (type conversions, normalization), or python (future: sandboxed execution)';
