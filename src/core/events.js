/**
 * events.js — The 11 shared memories.
 *
 * hasTextBox: true  → Phase 2 shows the full typewriter text box (events 1-6)
 * hasTextBox: false → Phase 2 shows dot + title label only (events 7-11)
 *
 * position: [x, y, z] on a unit sphere, distributed via Fibonacci sphere so
 * the globe reads well from the default camera angle (slight downward tilt).
 */

const RADIUS = 1.8

/**
 * Fibonacci sphere distribution — evenly spaces N points on a sphere.
 * We hand-pick 11 of the resulting positions and assign them to events.
 */
function fibonacciSphere(n, radius = 1) {
  const points = []
  const phi = Math.PI * (3 - Math.sqrt(5)) // golden angle in radians
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = phi * i
    points.push([
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    ])
  }
  return points
}

const positions = fibonacciSphere(11, RADIUS)

const EVENTS = [
  {
    id: 1,
    title: 'The First Meeting',
    text: 'You came to Kalman with your whole grade to perform a play. I saw you sitting with your friends and I knew I had to talk to you.',
    hasTextBox: true,
    position: positions[0],
  },
  {
    id: 2,
    title: 'First Date',
    text: 'Bowling, arcade games, and both of us pretending we weren\'t nervous.',
    hasTextBox: true,
    position: positions[1],
  },
  {
    id: 3,
    title: 'First Movie',
    text: 'I chose the most terrible movie in the cinema. You were horrified. I still don\'t regret it.',
    hasTextBox: true,
    position: positions[2],
  },
  {
    id: 4,
    title: 'Nahsholim',
    text: 'Just the two of us. Our first trip alone — the sea, the sun, and nobody else in the world.',
    hasTextBox: true,
    position: positions[3],
  },
  {
    id: 5,
    title: 'Sleep Over',
    text: 'The first time I stayed. We stayed up too late and neither of us wanted the night to end.',
    hasTextBox: true,
    position: positions[4],
  },
  {
    id: 6,
    title: 'Karting',
    text: 'We raced and neither of us was willing to lose. Afterwards I asked you what we were.',
    hasTextBox: true,
    position: positions[5],
  },
  {
    id: 7,
    title: 'We Became Official',
    text: null,
    hasTextBox: false,
    position: positions[6],
  },
  {
    id: 8,
    title: 'First Kiss',
    text: null,
    hasTextBox: false,
    position: positions[7],
  },
  {
    id: 9,
    title: 'The Sea',
    text: null,
    hasTextBox: false,
    position: positions[8],
  },
  {
    id: 10,
    title: 'Ice Skating',
    text: null,
    hasTextBox: false,
    position: positions[9],
  },
  {
    id: 11,
    title: 'Mini Golf',
    text: null,
    hasTextBox: false,
    position: positions[10],
  },
]

export default EVENTS
