export type Screen = 'home' | 'post' | 'palette' | 'search' | 'venue' | 'roulette' | 'my' | 'help' | 'report';
export type Go = (scr: Screen, venueId?: string) => void;
