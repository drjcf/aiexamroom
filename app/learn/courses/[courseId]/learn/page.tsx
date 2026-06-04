import { CoursePlayer } from '@edai/lms';
export default function Page({ params }: { params: { courseId: string } }) {
  return <CoursePlayer courseId={params.courseId} />;
}
