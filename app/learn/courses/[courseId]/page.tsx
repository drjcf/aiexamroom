import { CourseDetail } from '@edai/lms';
export default function Page({ params }: { params: { courseId: string } }) {
  return <CourseDetail courseId={params.courseId} />;
}
