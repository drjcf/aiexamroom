import { GradingPage } from '@edai/lms';
export default function Page({ params }: { params: { courseId: string } }) {
  return <GradingPage courseId={params.courseId} />;
}
