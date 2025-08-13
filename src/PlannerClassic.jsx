import { useState } from 'react';
import './PlannerClassic.css';
import Planner from './Planner';

// Lightweight wrapper that reuses Planner's logic but presents a WoW-like layout.
// For speed, we render Planner inside, but expose the container and grid to mimic the layout.
// If we need a fully split component, we can extract shared hooks from Planner later.
export default function PlannerClassic() {
  // For now, just reuse Planner and style the container similarly to classic layout.
  // This avoids duplicating all the data and picker logic.
  const [mounted] = useState(true);
  return <Planner variant="classic" />;
}
