import { AudienceLanding } from '../_components/AudienceLanding';
export default function Page() {
  return (
    <AudienceLanding
      kicker="For caregivers"
      title="Advocating when AI and the care team disagree."
      lede="When you care for someone, you are often the one holding the AI app, the questions, and the full picture. This course is about advocating well from that seat."
      points={[
        'Speaking up when AI and the clinician point in different directions.',
        'Verifying an AI claim before you act on it.',
        'Why you are the sensor the care team relies on between visits.',
      ]}
      courseId="course_caregiver"
      cta="Start the caregiver course"
    />
  );
}
