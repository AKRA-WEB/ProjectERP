import React from 'react';
import 'next/link';

declare module 'next/link' {
  export interface LinkProps {
    transitionTypes?: string[];
    viewTransition?: boolean;
  }
  export interface InternalLinkProps {
    transitionTypes?: string[];
    viewTransition?: boolean;
  }
}

declare module 'react' {
  interface Attributes {
    transitionTypes?: string[];
    viewTransition?: boolean;
  }
}
