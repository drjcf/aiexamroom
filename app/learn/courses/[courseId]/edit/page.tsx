import { CourseEditor } from '@edai/lms';
export default function Page({ params }: { params: { courseId: string } }) {
  return <CourseEditor courseId={params.courseId} />;
}
