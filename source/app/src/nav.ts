export type Screen = 'home' | 'post' | 'palette' | 'search' | 'venue' | 'roulette' | 'my';
export type Go = (scr: Screen, venueId?: number) => void;
