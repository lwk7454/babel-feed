import { trigger, transition, style, query, animate } from '@angular/animations';

export const fadeAnimation =
  trigger('routeAnimations', [
    transition('* <=> *', [ // Any route to any route
      // Set a default style for enter and leave
      query(':enter, :leave', [
        style({
          position: 'absolute', // Using absolute position for smooth transitions
          left: 0,
          width: '100%',
          opacity: 0,
          transform: 'scale(0.95) translateY(10px)', // Subtle scale and translate
        })
      ], { optional: true }),
      // Animate new page in
      query(':enter', [
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
      ], { optional: true })
    ])
  ]); 