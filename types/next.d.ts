import 'react';

declare module 'react' {
  interface Attributes {
    transitionTypes?: string[];
  }
}
