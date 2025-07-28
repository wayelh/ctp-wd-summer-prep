# Instructions for Breaking Up Large MDX Files

## Process for Splitting MDX Files

1. **Find large files** (>500 lines):
   ```bash
   find . -name "*.mdx" -exec wc -l {} \; | sort -rn | head -20
   ```

2. **Analyze structure**:
   ```bash
   grep "^## " filename.mdx -n  # Find section headers
   ```

3. **Create directory**:
   ```bash
   mkdir -p path/to/split-files
   ```

4. **Split pattern**:
   - `00-overview.mdx` - Title and introduction
   - `01-section-name.mdx` - Each ## section
   - Keep exercises inline (don't separate)
   - Adjust imports: `../components` → `../../components`

5. **Update imports** in split files:
   - Add missing imports (SlideLayout, CodeDisplay, etc.)
   - Fix relative paths for components

6. **Remove original** after splitting:
   ```bash
   rm original-file.mdx
   ```

## Current Progress

### Completed:
- react-sections/data-fetching.mdx (1976 lines) → 8 files
- js-intro-sections/css-fundamentals.mdx (1946 lines) → 12 files  
- react-sections/state-hooks.mdx (1926 lines) → 10 files
- react-sections/components-props.mdx (1898 lines) → 10 files
- react-sections/events-and-forms.mdx (1732 lines) → 9 files
- js-intro-sections/dom-manipulation.mdx (974 lines) → 11 files

### In Progress:
- js-intro-sections/objects-and-arrays.mdx (804 lines)

### Pending:
- js-intro-sections/html-basics.mdx (747 lines)
- ts-intro-sections/generics.mdx (580 lines)
- js-intro-sections/advanced-functions.mdx (568 lines)
- js-intro-sections/async-javascript.mdx (542 lines)

## Key Rules:
- Keep exercises within their section files
- Maintain educational flow
- Preserve all code examples and tests
- Use TodoWrite to track progress
- Test that imports work after splitting