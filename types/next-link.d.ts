import 'next/link';

declare module 'next/link' {
  interface InternalLinkProps {
    viewTransition?: boolean;
    transitionTypes?: string[];
  }
}
