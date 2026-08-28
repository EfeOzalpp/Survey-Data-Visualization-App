interface ButtonQuestion {
  id: string;
  prompt: string;
  options: { key: string; label: string; weight: number }[];
}

export const BUTTON_QUESTIONS: ButtonQuestion[] = [
  {
    id: 'q1',
    prompt: 'What guides your food choices?',
    options: [
      { key: 'A', label: 'Local foods',     weight: 1.0  },
      { key: 'B', label: 'Mostly vegetables', weight: 0.85 },
      { key: 'C', label: 'Balanced meals',       weight: 0.67 },
      { key: 'D', label: 'Beef and dairy',  weight: 0.45 },
      { key: 'E', label: 'Imported food',     weight: 0.25 },
    ],
  },
  {
    id: 'q2',
    prompt: "What's your usual commute?",
    options: [
      { key: 'A', label: 'Walking',    weight: 1.0  },
      { key: 'B', label: 'Bike',    weight: 0.95 },
      { key: 'C', label: 'Public Transportation', weight: 0.8 },
      { key: 'D', label: 'Rideshare', weight: 0.6 },
      { key: 'E', label: 'Electric',      weight: 0.3 },
      { key: 'F', label: 'Drive',   weight: 0.05 },
    ],
  },
  {
    id: 'q3',
    prompt: 'How do you save energy at home?',
    options: [
      { key: 'A', label: 'Careful heating', weight: 0.9  },
      { key: 'B', label: 'Air dry',          weight: 0.75 },
      { key: 'C', label: 'Turn off lights',  weight: 0.7  },
      { key: 'D', label: 'Avoid standby',    weight: 0.6  },
      { key: 'E', label: 'Not really',       weight: 0.1 },
      { key: 'F', label: 'Don\'t have home', weight: 1 },
    ],
  },
  {
    id: 'q4',
    prompt: 'When you shop, what feels most like you?',
    options: [
      { key: 'A', label: 'Thrift first', weight: 1.0  },
      { key: 'B', label: 'Buy to last',  weight: 0.75  },
      { key: 'C', label: 'Shop local',   weight: 0.65 },
      { key: 'D', label: 'Natural materials',   weight: 0.8  },
      { key: 'E', label: 'Mass-purchase',      weight: 0.25  },
      { key: 'F', label: 'Synthetic clothes', weight: 0.0  },
    ],
  },
  {
    id: 'q5',
    prompt: 'How do you handle waste at home?',
    options: [
      { key: 'A', label: 'Compost often',        weight: 1.0  },
      { key: 'B', label: 'Sort carefully', weight: 0.75 },
      { key: 'C', label: 'Recycle at times',        weight: 0.5  },
      { key: 'D', label: 'Sometimes do',      weight: 0.25 },
      { key: 'E', label: 'Toss all',       weight: 0.0  },
    ],
  },
];
