import { useNavigate } from 'react-router-dom';
import { EquipmentTree, ErrorText, Page, useLoad } from '../ui';
import type { Equipment } from '../types';

export default function MyEquipmentPage() {
  const { data, error } = useLoad<Equipment[]>('/equipment/my');
  const navigate = useNavigate();

  return (
    <Page title="Моє обладнання" hint="Техніка, закріплена за вами. Натисніть на пристрій, щоб повідомити про несправність.">
      <ErrorText text={error} />
      {data && <EquipmentTree items={data} onSelect={(item) => navigate(`/new-request/${item.equipment_id}`)} />}
    </Page>
  );
}
