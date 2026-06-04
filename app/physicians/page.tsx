import { AudienceLanding } from '../_components/AudienceLanding';
export default function Page() {
  return (
    <AudienceLanding
      kicker="For physicians"
      title="Receiving the AI-informed patient."
      lede="Patients now arrive with answers. This course is about the encounter that follows — validating what AI got right, correcting what it missed, and documenting the difference."
      points={[
        'The exam AI could not do, and how to make it visible to the patient.',
        'Teaching intelligent humility without dismissing the patient’s work.',
        'The accountability asymmetry: who carries the consequence.',
      ]}
      courseId="course_physician"
      cta="Start the physician course"
    />
  );
}
