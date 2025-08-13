import './RoRview.css';
import Planner from './Planner';

export default function RoRview(){
  // Reuse Planner logic but with ror variant for slot wrapper/labels
  return <Planner variant="ror" />;
}
