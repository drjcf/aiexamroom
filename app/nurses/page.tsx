import { AudienceLanding } from '../_components/AudienceLanding';
export default function Page() {
  return (
    <AudienceLanding
      kicker="For nurses"
      title="AI at the bedside."
      lede="Nurses meet the AI-informed patient first and last. This course is about triage, reconciliation, and education when AI is already in the room."
      points={[
        'Triaging a patient who arrives with an AI answer.',
        'Reconciling medications against what an AI tool claimed.',
        'Educating patients and families about AI’s limits at the bedside.',
      ]}
      courseId="course_nurse"
      cta="Start the nursing course"
    />
  );
}
