import { AudienceLanding } from '../_components/AudienceLanding';
export default function Page() {
  return (
    <AudienceLanding
      kicker="For patients"
      title="Walking in with an answer from AI."
      lede="AI can give you a plausible answer before you ever see a clinician. This course is about using that well — bringing it to your visit so it helps, and knowing when to set it aside and get seen."
      points={[
        'How to share what AI told you without anchoring your doctor to it.',
        'The red flags that mean stop reading and seek care now.',
        'What a clinician can see that AI never could.',
      ]}
      courseId="course_patient"
      cta="Start the patient course"
    />
  );
}
