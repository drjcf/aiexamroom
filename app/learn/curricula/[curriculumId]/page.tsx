import { CurriculumDetail } from '@edai/lms';
export default function Page({ params }: { params: { curriculumId: string } }) {
  return <CurriculumDetail curriculumId={params.curriculumId} />;
}
