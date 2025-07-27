# CTP Presentations Structure

The presentations have been reorganized to support both individual section viewing and full course presentation modes.

## Structure Overview

### Entry Points

1. **Main Index** (`/index.html`)
   - Landing page with three options:
   - Individual Sections browser
   - Full JavaScript course
   - Full TypeScript course

2. **Individual Sections** (`/sections.html`)
   - Grid view of all available sections
   - Toggle between JavaScript and TypeScript tracks
   - Direct links to individual section presentations

3. **Combined Presentations** (`/combined.html`)
   - Traditional full-course slide experience
   - Supports both JavaScript and TypeScript via URL parameter
   - Includes presentation switcher in top-right corner

### Individual Section Files

Each section is now a standalone presentation with:
- Navigation slide at the beginning (with link to previous section)
- All original content slides
- Navigation slide at the end (with link to next section)
- "Back to all sections" link on navigation slides

#### JavaScript Sections
- `js-introduction.html` - Introduction
- `js-html-basics.html` - HTML Basics
- `js-css-fundamentals.html` - CSS Fundamentals
- `js-variables-and-types.html` - Variables & Types
- `js-functions.html` - Functions
- `js-control-flow.html` - Control Flow
- `js-objects-and-arrays.html` - Objects & Arrays
- `js-dom-manipulation.html` - DOM Manipulation
- `js-async-javascript.html` - Async JavaScript
- `js-error-handling.html` - Error Handling
- `js-advanced-functions.html` - Advanced Functions
- `js-prototypes.html` - Prototypes
- `js-modules.html` - Modules
- `js-modern-features.html` - Modern Features
- `js-common-pitfalls.html` - Common Pitfalls
- `js-best-practices.html` - Best Practices

#### TypeScript Sections
- `ts-introduction.html` - Introduction
- `ts-type-basics.html` - Type Basics
- `ts-interfaces-and-types.html` - Interfaces & Types
- `ts-unions-and-literals.html` - Unions & Literals
- `ts-generics.html` - Generics
- `ts-type-guards.html` - Type Guards
- `ts-utility-types.html` - Utility Types
- `ts-classes-and-oop.html` - Classes & OOP
- `ts-modules-and-namespaces.html` - Modules & Namespaces
- `ts-async-types.html` - Async Types
- `ts-common-patterns.html` - Common Patterns
- `ts-react-typescript.html` - React & TypeScript
- `ts-testing-typescript.html` - Testing TypeScript
- `ts-migration-strategies.html` - Migration Strategies
- `ts-ecosystem-and-tools.html` - Ecosystem & Tools

## Navigation Features

### Section Navigation Component
- Automatically detects previous/next sections based on configuration
- Shows section title and navigation context
- Provides "Back to all sections" link
- Responsive design with hover effects

### Section Configuration
- Centralized configuration in `sections.config.ts`
- Defines section order and relationships
- Used by navigation component and section index

## Development

### Adding New Sections
1. Create the MDX file in the appropriate directory
2. Add entry to `sections.config.ts`
3. Run the generators:
   ```bash
   node generate-sections.js
   node generate-html-files.js
   ```
4. Update `vite.config.ts` if needed

### Generators
- `generate-sections.js` - Creates individual presentation TSX files
- `generate-html-files.js` - Creates HTML entry points for each section

### Build Configuration
The Vite config generates multiple entry points:
- Main index page
- Section browser page
- Combined presentation page
- Individual section pages (auto-generated)

## Usage Scenarios

### For Instructors
- Use individual sections for targeted lessons
- Jump between specific topics during class
- Share direct links to specific sections with students

### For Students
- Review specific concepts without full presentation
- Navigate learning path at their own pace
- Bookmark specific sections for later reference

### For Presentations
- Use combined mode for traditional slide presentation
- Switch between JavaScript and TypeScript content
- Full-screen presentation experience

## Benefits

1. **Flexibility** - Choose between modular or linear presentation styles
2. **Performance** - Individual sections load faster than full presentation
3. **Navigation** - Easy movement between related sections
4. **Maintainability** - Each section can be updated independently
5. **Usability** - Multiple entry points for different use cases