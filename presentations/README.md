# CTP Presentations

Interactive presentation system for Code the Dream's JavaScript, TypeScript, and React curriculum.

Made with ❤️ and [Spectacle](https://github.com/FormidableLabs/spectacle/).

## Features

- **Multi-track Curriculum**: JavaScript, TypeScript, and React presentations
- **Interactive Navigation**: Seamless navigation between presentations and slides
- **Live Code Editing**: Built-in Monaco editor with theme switching
- **Multi-file Code Display**: Support for HTML, CSS, JS, and test files
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Theme Support**: Light and dark themes for code editors

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Presentation Structure

The presentation system is organized into three main tracks:

### JavaScript (`js-intro-sections/`)
- **HTML Basics** - Web page structure and semantic HTML
- **CSS Fundamentals** - Styling, layout, and responsive design
- **Fullstack Introduction** - Overview of full-stack development
- **JavaScript Introduction** - Variables, functions, and control flow
- **Objects and Arrays** - Data structures and manipulation
- **DOM Manipulation** - Interactive web pages
- **Async JavaScript** - Promises, async/await, and event handling
- **Advanced Functions** - Closures, higher-order functions, and functional programming
- **Error Handling** - Exception handling and debugging
- **Modern Features** - ES6+ features and best practices

### TypeScript (`ts-intro-sections/`)
- **Introduction** - TypeScript fundamentals and setup
- **Type Basics** - Primitive types, arrays, and objects
- **Interfaces and Types** - Custom type definitions
- **Generics** - Type parameters and constraints
- **Advanced Types** - Unions, literals, and utility types
- **Classes and OOP** - Object-oriented programming in TypeScript
- **React with TypeScript** - Typed React components and hooks

### React (`react-sections/`)
- **Introduction** - React fundamentals and JSX
- **Components and Props** - Building reusable components
- **State and Hooks** - Managing component state
- **Events and Forms** - User interaction handling
- **Advanced Patterns** - HOCs, render props, and composition
- **Styling Approaches** - CSS-in-JS, modules, and Tailwind
- **Performance Optimization** - Memoization and code splitting
- **Data Fetching** - API integration and state management

## File Organization

### Main Structure
```
presentations/
├── index.tsx                 # Main application entry point
├── components/              # Shared presentation components
├── js-intro-sections/       # JavaScript curriculum
├── ts-intro-sections/       # TypeScript curriculum
├── react-sections/          # React curriculum
└── styles.css              # Global styles
```

### Section Structure
Each section follows this pattern:
```
section-name/
├── section-name.mdx         # Main file that imports and renders all slides
└── section-name/           # Directory with individual slide files
    ├── 00-overview.mdx
    ├── 01-topic-one.mdx
    ├── 02-topic-two.mdx
    └── ...
```

### Individual Slides
Slides are written in MDX and support:
- Spectacle slide layouts
- Interactive code examples with `<CodeDisplay>`
- Multi-file code demonstrations
- Embedded exercises and tests

## Navigation

- **Arrow Keys**: Navigate between slides
- **Hamburger Menu**: Switch between presentations
- **Auto-advance**: Automatically moves to next presentation at the end
- **URL State**: Bookmarkable slide positions

## Components

### CodeDisplay
Interactive code editor with multiple file support:
```mdx
<CodeDisplay>
  <File name="index.html">
    ```html
    <!DOCTYPE html>
    <html>...</html>
    ```
  </File>
  <File name="styles.css">
    ```css
    body { margin: 0; }
    ```
  </File>
  <Tests>
    ```javascript
    describe('Tests', () => {
      it('should work', () => {
        expect(true).toBe(true);
      });
    });
    ```
  </Tests>
</CodeDisplay>
```

### Slide Layouts
Built on Spectacle's layout system:
```mdx
<SlideLayout.VerticalImage
  title="Section Title"
  src="image-url"
  listItems={['Point 1', 'Point 2']}
/>

<SlideLayout.Full>
## Custom Content
Your markdown content here
</SlideLayout.Full>
```

## Development

### Adding New Presentations

1. Create a new directory in the appropriate section folder
2. Create individual slide files (00-overview.mdx, 01-topic.mdx, etc.)
3. Create a main section file that imports and renders all slides:
   ```mdx
   import Overview from './section-name/00-overview.mdx'
   import Topic from './section-name/01-topic.mdx'

   <Overview {...props} />
   <Topic {...props} />
   ```
4. Add the presentation to `index.tsx` in the presentations object

### Theme Development
Themes are managed through the `ThemeProvider` context:
- Light theme: `vs`
- Dark theme: `vs-dark`
- Saved to localStorage for persistence

### Code Editor Features
- Monaco Editor integration
- Syntax highlighting for HTML, CSS, JS, TS
- Live preview capabilities
- Responsive layout with collapsible panels

## Deployment

The presentation system builds to static files that can be deployed to any web server:

```bash
npm run build
# Deploy the dist/ directory
```

## Contributing

1. Follow the existing file structure and naming conventions
2. Use semantic MDX with proper slide layouts
3. Include interactive examples where appropriate
4. Test navigation between slides and presentations
5. Ensure responsive design works on all devices

## Architecture

- **React 18** with TypeScript
- **Spectacle** for slide presentation
- **Monaco Editor** for code editing
- **Vite** for build tooling
- **MDX** for slide content
- **Context API** for theme management

For more detailed information, see `STRUCTURE.md`.