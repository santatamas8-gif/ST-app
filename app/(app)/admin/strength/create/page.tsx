import { getSetRepSchemes, getStrengthExercises } from "@/app/actions/strength";
import { CreateSessionView } from "./CreateSessionView";

export default async function CreateStrengthSessionPage() {
  const [exercises, schemes] = await Promise.all([getStrengthExercises(), getSetRepSchemes()]);
  return <CreateSessionView exercises={exercises} schemes={schemes} />;
}
