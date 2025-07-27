export interface SectionConfig {
  id: string;
  name: string;
  url: string;
  sectionKey: string; // For dynamic loading
}

export const jsSections: SectionConfig[] = [
  { id: 'introduction', name: 'Introduction', url: '/section?id=js-introduction', sectionKey: 'js-introduction' },
  { id: 'html-basics', name: 'HTML Basics', url: '/section?id=js-html-basics', sectionKey: 'js-html-basics' },
  { id: 'css-fundamentals', name: 'CSS Fundamentals', url: '/section?id=js-css-fundamentals', sectionKey: 'js-css-fundamentals' },
  { id: 'variables-and-types', name: 'Variables & Types', url: '/section?id=js-variables-and-types', sectionKey: 'js-variables-and-types' },
  { id: 'functions', name: 'Functions', url: '/section?id=js-functions', sectionKey: 'js-functions' },
  { id: 'control-flow', name: 'Control Flow', url: '/section?id=js-control-flow', sectionKey: 'js-control-flow' },
  { id: 'objects-and-arrays', name: 'Objects & Arrays', url: '/section?id=js-objects-and-arrays', sectionKey: 'js-objects-and-arrays' },
  { id: 'dom-manipulation', name: 'DOM Manipulation', url: '/section?id=js-dom-manipulation', sectionKey: 'js-dom-manipulation' },
  { id: 'async-javascript', name: 'Async JavaScript', url: '/section?id=js-async-javascript', sectionKey: 'js-async-javascript' },
  { id: 'error-handling', name: 'Error Handling', url: '/section?id=js-error-handling', sectionKey: 'js-error-handling' },
  { id: 'advanced-functions', name: 'Advanced Functions', url: '/section?id=js-advanced-functions', sectionKey: 'js-advanced-functions' },
  { id: 'prototypes', name: 'Prototypes', url: '/section?id=js-prototypes', sectionKey: 'js-prototypes' },
  { id: 'modules', name: 'Modules', url: '/section?id=js-modules', sectionKey: 'js-modules' },
  { id: 'modern-features', name: 'Modern Features', url: '/section?id=js-modern-features', sectionKey: 'js-modern-features' },
  { id: 'common-pitfalls', name: 'Common Pitfalls', url: '/section?id=js-common-pitfalls', sectionKey: 'js-common-pitfalls' },
  { id: 'best-practices', name: 'Best Practices', url: '/section?id=js-best-practices', sectionKey: 'js-best-practices' }
];

export const tsSections: SectionConfig[] = [
  { id: 'introduction', name: 'Introduction', url: '/section?id=ts-introduction', sectionKey: 'ts-introduction' },
  { id: 'type-basics', name: 'Type Basics', url: '/section?id=ts-type-basics', sectionKey: 'ts-type-basics' },
  { id: 'interfaces-and-types', name: 'Interfaces & Types', url: '/section?id=ts-interfaces-and-types', sectionKey: 'ts-interfaces-and-types' },
  { id: 'unions-and-literals', name: 'Unions & Literals', url: '/section?id=ts-unions-and-literals', sectionKey: 'ts-unions-and-literals' },
  { id: 'generics', name: 'Generics', url: '/section?id=ts-generics', sectionKey: 'ts-generics' },
  { id: 'type-guards', name: 'Type Guards', url: '/section?id=ts-type-guards', sectionKey: 'ts-type-guards' },
  { id: 'utility-types', name: 'Utility Types', url: '/section?id=ts-utility-types', sectionKey: 'ts-utility-types' },
  { id: 'classes-and-oop', name: 'Classes & OOP', url: '/section?id=ts-classes-and-oop', sectionKey: 'ts-classes-and-oop' },
  { id: 'modules-and-namespaces', name: 'Modules & Namespaces', url: '/section?id=ts-modules-and-namespaces', sectionKey: 'ts-modules-and-namespaces' },
  { id: 'async-types', name: 'Async Types', url: '/section?id=ts-async-types', sectionKey: 'ts-async-types' },
  { id: 'common-patterns', name: 'Common Patterns', url: '/section?id=ts-common-patterns', sectionKey: 'ts-common-patterns' },
  { id: 'react-typescript', name: 'React & TypeScript', url: '/section?id=ts-react-typescript', sectionKey: 'ts-react-typescript' },
  { id: 'testing-typescript', name: 'Testing TypeScript', url: '/section?id=ts-testing-typescript', sectionKey: 'ts-testing-typescript' },
  { id: 'migration-strategies', name: 'Migration Strategies', url: '/section?id=ts-migration-strategies', sectionKey: 'ts-migration-strategies' },
  { id: 'ecosystem-and-tools', name: 'Ecosystem & Tools', url: '/section?id=ts-ecosystem-and-tools', sectionKey: 'ts-ecosystem-and-tools' }
];

export function getSectionNavigation(sectionId: string, sections: SectionConfig[]) {
  const currentIndex = sections.findIndex(section => section.id === sectionId);
  if (currentIndex === -1) return null;

  const previousSection = currentIndex > 0 ? sections[currentIndex - 1] : undefined;
  const nextSection = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : undefined;

  return {
    current: sections[currentIndex],
    previous: previousSection,
    next: nextSection
  };
}