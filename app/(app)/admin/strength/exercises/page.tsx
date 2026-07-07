import { getStrengthExercises } from "@/app/actions/strength";
import { ExercisesAdminView } from "./ExercisesAdminView";

export default async function StrengthExercisesPage() {
  const exercises = await getStrengthExercises(false);
  return <ExercisesAdminView exercises={exercises} />;
}
