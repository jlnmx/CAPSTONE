import { AppBoldFontFamily, AppFontFamily, AppHeadingFontFamily } from '@constants/typography';

type EvacuationCenterInfo = {
  name: string;
  location: string;
  capacity: number;
  current_occupancy?: number;
  currentOccupancy?: number;
  status: 'available' | 'limited' | 'full' | 'closed';
};

export function createEvacuationCenterInfoContent(
  center: EvacuationCenterInfo,
  onNavigate: () => void,
): HTMLDivElement {
  const capacity = Math.max(0, Number(center.capacity) || 0);
  const occupancy = Math.max(0, Number(center.current_occupancy ?? center.currentOccupancy) || 0);
  const spaces = Math.max(0, capacity - occupancy);
  const unavailable = center.status === 'closed' || center.status === 'full' || spaces === 0;
  const availability = center.status === 'closed'
    ? 'Closed'
    : center.status === 'full' || spaces === 0
      ? 'Full'
      : center.status === 'limited'
        ? 'Limited availability'
        : 'Spaces available';

  const card = document.createElement('div');
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${center.name} evacuation center details`);
  Object.assign(card.style, {
    width: '250px',
    maxWidth: 'calc(100vw - 96px)',
    padding: '4px 2px 2px',
    boxSizing: 'border-box',
    color: '#17212B',
    fontFamily: AppFontFamily,
  });

  const heading = document.createElement('div');
  Object.assign(heading.style, { display: 'flex', alignItems: 'center', gap: '10px' });
  const icon = document.createElement('div');
  icon.textContent = 'EC';
  Object.assign(icon.style, {
    width: '38px',
    height: '38px',
    flex: '0 0 38px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '13px',
    background: '#E8F4E8',
    color: '#218B25',
    fontSize: '11px',
    fontFamily: AppBoldFontFamily,
    letterSpacing: '0.5px',
  });

  const titleCopy = document.createElement('div');
  Object.assign(titleCopy.style, { minWidth: '0', flex: '1' });
  const eyebrow = document.createElement('div');
  eyebrow.textContent = 'EVACUATION CENTER';
  Object.assign(eyebrow.style, { color: '#68767D', fontFamily: AppBoldFontFamily, fontSize: '9px', letterSpacing: '0.8px' });
  const title = document.createElement('div');
  title.textContent = center.name;
  Object.assign(title.style, { marginTop: '2px', fontFamily: AppHeadingFontFamily, fontSize: '15px', lineHeight: '19px', overflowWrap: 'anywhere' });
  const location = document.createElement('div');
  location.textContent = center.location || 'Location not provided';
  Object.assign(location.style, { marginTop: '3px', color: '#667085', fontSize: '11px', lineHeight: '15px', overflowWrap: 'anywhere' });
  titleCopy.append(eyebrow, title, location);
  heading.append(icon, titleCopy);
  card.append(heading);

  const availabilityRow = document.createElement('div');
  Object.assign(availabilityRow.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '11px',
    padding: '6px 9px',
    borderRadius: '999px',
    background: unavailable ? '#FCE8E6' : center.status === 'limited' ? '#FFF4DF' : '#E8F4E8',
    color: unavailable ? '#B3261E' : center.status === 'limited' ? '#96600A' : '#218B25',
    fontSize: '10px',
    fontFamily: AppBoldFontFamily,
  });
  const statusDot = document.createElement('span');
  Object.assign(statusDot.style, {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: unavailable ? '#D83B36' : center.status === 'limited' ? '#D99113' : '#218B25',
  });
  availabilityRow.append(statusDot, document.createTextNode(availability));
  card.append(availabilityRow);

  const stats = document.createElement('div');
  Object.assign(stats.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' });
  const createStat = (value: string, label: string) => {
    const stat = document.createElement('div');
    Object.assign(stat.style, { minWidth: '0', padding: '9px', borderRadius: '11px', background: '#F3F6F8' });
    const statValue = document.createElement('div');
    statValue.textContent = value;
    Object.assign(statValue.style, { fontFamily: AppHeadingFontFamily, fontSize: '15px', lineHeight: '19px' });
    const statLabel = document.createElement('div');
    statLabel.textContent = label;
    Object.assign(statLabel.style, { marginTop: '2px', color: '#667085', fontSize: '9px', lineHeight: '13px' });
    stat.append(statValue, statLabel);
    return stat;
  };
  stats.append(createStat(`${occupancy} / ${capacity}`, 'People at center'), createStat(`${spaces}`, 'Spaces remaining'));
  card.append(stats);

  const navigateButton = document.createElement('button');
  navigateButton.type = 'button';
  navigateButton.textContent = 'Navigate to center';
  navigateButton.setAttribute('aria-label', `Navigate to ${center.name}`);
  Object.assign(navigateButton.style, {
    width: '100%',
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '11px',
    border: '0',
    borderRadius: '11px',
    background: '#218B25',
    color: '#FFFFFF',
    fontSize: '12px',
    fontFamily: AppBoldFontFamily,
    cursor: 'pointer',
  });
  navigateButton.addEventListener('click', onNavigate);
  card.append(navigateButton);

  return card;
}
