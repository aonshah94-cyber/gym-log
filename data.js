// Built-in muscle groups, exercise library and training splits.
window.GYM_DATA = {
  MUSCLES: {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    abs: 'Abs',
    legs: 'Legs',
  },

  // Exercise count a muscle group starts with when added to a day.
  DEFAULT_COUNT: { chest: 3, back: 3, shoulders: 3, biceps: 2, triceps: 2, forearms: 1, abs: 2, legs: 4 },

  // A plain list, or sub-groups shown as headings inside the picker.
  LIBRARY: {
    chest: [
      'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Dumbbell Bench Press',
      'Incline Dumbbell Press', 'Decline Dumbbell Press', 'Machine Chest Press', 'Incline Machine Press',
      'Smith Machine Bench Press', 'Smith Machine Incline Press', 'Dumbbell Fly', 'Incline Dumbbell Fly',
      'Cable Fly', 'Low-to-High Cable Fly', 'High-to-Low Cable Fly', 'Pec Deck', 'Push-Up', 'Chest Dip',
      'Dumbbell Pullover',
    ],
    back: [
      'Pull-Up', 'Chin-Up', 'Lat Pulldown', 'Close-Grip Lat Pulldown', 'Single-Arm Lat Pulldown',
      'Barbell Row', 'Dumbbell Row', 'T-Bar Row', 'Seated Cable Row', 'Machine Row', 'Chest-Supported Row',
      'Straight-Arm Pulldown', 'Deadlift', 'Rack Pull', 'Back Extension', 'Barbell Shrug', 'Dumbbell Shrug',
    ],
    shoulders: [
      'Overhead Press', 'Seated Dumbbell Press', 'Arnold Press', 'Machine Shoulder Press',
      'Smith Machine Shoulder Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Machine Lateral Raise',
      'Front Raise', 'Rear Delt Fly', 'Reverse Pec Deck', 'Face Pull', 'Upright Row', 'Barbell Shrug',
      'Dumbbell Shrug',
    ],
    biceps: [
      'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Preacher Curl',
      'Machine Preacher Curl', 'Concentration Curl', 'Cable Curl', 'Rope Hammer Curl', 'Bayesian Cable Curl',
      'Spider Curl', 'Reverse Curl',
    ],
    triceps: [
      'Tricep Pushdown', 'Rope Pushdown', 'Single-Arm Pushdown', 'Overhead Cable Extension',
      'Overhead Dumbbell Extension', 'Skull Crusher', 'Close-Grip Bench Press', 'Tricep Dip', 'Bench Dip',
      'Dumbbell Kickback', 'Cable Tricep Kickback', 'Machine Tricep Extension',
    ],
    forearms: [
      'Wrist Curl', 'Reverse Wrist Curl', 'Reverse Curl', 'Farmer\'s Carry', 'Dead Hang', 'Wrist Roller',
    ],
    abs: [
      'Crunch', 'Cable Crunch', 'Machine Crunch', 'Hanging Leg Raise', 'Lying Leg Raise', 'Plank', 'Side Plank',
      'Russian Twist', 'Ab Wheel Rollout', 'Bicycle Crunch', 'Decline Sit-Up', 'Mountain Climber',
    ],
    legs: {
      Quads: [
        'Squat', 'Front Squat', 'Hack Squat', 'Smith Machine Squat', 'Goblet Squat', 'Leg Press',
        'Leg Extension', 'Bulgarian Split Squat', 'Walking Lunge',
      ],
      Hamstrings: ['Romanian Deadlift', 'Stiff-Leg Deadlift', 'Lying Leg Curl', 'Seated Leg Curl', 'Good Morning'],
      Glutes: ['Hip Thrust', 'Glute Bridge', 'Glute Kickback', 'Hip Abduction', 'Hip Adduction'],
      Calves: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise'],
    },
  },

  // Each day: [name, { muscle: number of exercises }]
  SPLITS: [
    { name: 'Chest & Biceps / Back & Triceps / Shoulders / Legs', days: [
      ['Chest & Biceps', { chest: 4, biceps: 3 }],
      ['Back & Triceps', { back: 4, triceps: 3 }],
      ['Shoulders', { shoulders: 5 }],
      ['Legs', { legs: 5 }],
    ] },
    { name: 'Chest & Triceps / Back & Biceps / Legs / Shoulders', days: [
      ['Chest & Triceps', { chest: 4, triceps: 3 }],
      ['Back & Biceps', { back: 4, biceps: 3 }],
      ['Legs', { legs: 5 }],
      ['Shoulders & Abs', { shoulders: 4, abs: 2 }],
    ] },
    { name: 'Push / Pull / Legs', days: [
      ['Push', { chest: 3, shoulders: 2, triceps: 2 }],
      ['Pull', { back: 4, biceps: 2 }],
      ['Legs', { legs: 5, abs: 1 }],
    ] },
    { name: 'Push / Pull / Legs ×2 (6-day)', days: [
      ['Push A', { chest: 3, shoulders: 2, triceps: 2 }],
      ['Pull A', { back: 4, biceps: 2 }],
      ['Legs A', { legs: 5, abs: 1 }],
      ['Push B', { chest: 3, shoulders: 2, triceps: 2 }],
      ['Pull B', { back: 4, biceps: 2 }],
      ['Legs B', { legs: 5, abs: 1 }],
    ] },
    { name: 'Upper / Lower (4-day)', days: [
      ['Upper A', { chest: 2, back: 2, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Lower A', { legs: 5, abs: 1 }],
      ['Upper B', { chest: 2, back: 2, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Lower B', { legs: 5, abs: 1 }],
    ] },
    { name: 'Full Body (3-day)', days: [
      ['Full Body A', { legs: 2, chest: 1, back: 1, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Full Body B', { legs: 2, chest: 1, back: 1, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Full Body C', { legs: 2, chest: 1, back: 1, shoulders: 1, biceps: 1, triceps: 1 }],
    ] },
    { name: 'Bro Split (5-day)', days: [
      ['Chest', { chest: 5 }],
      ['Back', { back: 5 }],
      ['Shoulders', { shoulders: 5 }],
      ['Arms', { biceps: 3, triceps: 3 }],
      ['Legs', { legs: 5 }],
    ] },
    { name: 'Arnold Split', days: [
      ['Chest & Back', { chest: 3, back: 3 }],
      ['Shoulders & Arms', { shoulders: 3, biceps: 2, triceps: 2 }],
      ['Legs', { legs: 5, abs: 1 }],
    ] },
    { name: 'Upper / Lower + Push / Pull / Legs (5-day)', days: [
      ['Upper', { chest: 2, back: 2, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Lower', { legs: 5, abs: 1 }],
      ['Push', { chest: 3, shoulders: 2, triceps: 2 }],
      ['Pull', { back: 4, biceps: 2 }],
      ['Legs', { legs: 5 }],
    ] },
    { name: 'Push / Pull (2-day rotation)', days: [
      ['Push', { chest: 2, shoulders: 2, triceps: 1, legs: 2 }],
      ['Pull', { back: 3, biceps: 2, legs: 2 }],
    ] },
    { name: 'Torso / Limbs', days: [
      ['Torso', { chest: 3, back: 3, abs: 1 }],
      ['Limbs', { shoulders: 2, biceps: 2, triceps: 2, legs: 3 }],
    ] },
    { name: 'PHUL (4-day)', days: [
      ['Upper Power', { chest: 2, back: 2, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Lower Power', { legs: 4 }],
      ['Upper Hypertrophy', { chest: 2, back: 2, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Lower Hypertrophy', { legs: 5 }],
    ] },
    { name: 'PHAT (5-day)', days: [
      ['Upper Power', { back: 3, chest: 2, shoulders: 1, biceps: 1, triceps: 1 }],
      ['Lower Power', { legs: 4 }],
      ['Back & Shoulders', { back: 4, shoulders: 3 }],
      ['Lower Hypertrophy', { legs: 5 }],
      ['Chest & Arms', { chest: 3, biceps: 2, triceps: 2 }],
    ] },
    { name: 'One Muscle a Day (6-day)', days: [
      ['Chest', { chest: 5 }],
      ['Back', { back: 5 }],
      ['Shoulders', { shoulders: 5 }],
      ['Biceps', { biceps: 4 }],
      ['Triceps', { triceps: 4 }],
      ['Legs', { legs: 5 }],
    ] },
    { name: 'Custom — build your own', days: [
      ['Day 1', {}],
    ] },
  ],
};
