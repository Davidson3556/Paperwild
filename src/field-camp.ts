import { FIELD_CAMP_KETTLE, FIELD_CAMP_POST, FIELD_CAMP_RADIO } from './field-camp-art.ts';

export type CampResident = 'kettle' | 'post' | 'radio';
const RESIDENTS: Record<CampResident, { art: string; label: string; title: string; replies: readonly string[] }> = {
  kettle: { art: FIELD_CAMP_KETTLE, label: 'Put the camp kettle on', title: 'The kettle committee', replies: ['The mouse ordered one more minute of sleep.', 'Tea for the brave. Biscuits for everyone.', 'A very small fire. A very important kettle.'] },
  post: { art: FIELD_CAMP_POST, label: 'Send a letter with the beetle post', title: 'Beetle post, always almost on time', replies: ['Your letter is taking the scenic route.', 'Special delivery: one encouraging thought.', 'The stamp is bigger than the postman.'] },
  radio: { art: FIELD_CAMP_RADIO, label: 'Wind up the mushroom radio', title: 'Radio Small Hours', replies: ['Tonight’s forecast: a chance of humming.', 'You are listening to the woodland wireless.', 'The moth is taking requests. Slowly.'] },
};

export function createFieldCamp(host: HTMLElement, onInteraction: (resident: CampResident) => void) {
  let resident: CampResident = 'kettle';
  let visits = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  host.classList.add('field-camp');
  host.innerHTML = `<div class="camp-number">FIELD STATION / 03</div><button class="camp-scene" type="button" data-testid="camp-scene"></button><p class="camp-caption"></p><div class="camp-stations" aria-label="Visit a field station">${(['kettle','post','radio'] as const).map((name, i)=>`<button type="button" data-camp="${name}" aria-label="Visit ${RESIDENTS[name].title}" aria-pressed="${i===0}">${['kettle','post','radio'][i]}</button>`).join('')}</div><p class="camp-reply" role="status" aria-live="polite" aria-atomic="true"></p>`;
  const scene = host.querySelector<HTMLButtonElement>('.camp-scene')!;
  const caption = host.querySelector<HTMLParagraphElement>('.camp-caption')!;
  const reply = host.querySelector<HTMLParagraphElement>('.camp-reply')!;
  function draw() {
    host.dataset.station = resident;
    scene.setAttribute('aria-label', RESIDENTS[resident].label);
    scene.innerHTML = RESIDENTS[resident].art;
    caption.textContent = RESIDENTS[resident].title;
    for (const button of host.querySelectorAll<HTMLButtonElement>('[data-camp]')) button.setAttribute('aria-pressed', String(button.dataset.camp === resident));
  }
  function greet(next: CampResident = resident) {
    if (destroyed) return;
    clearTimeout(timer);
    if (resident !== next) { resident = next; visits = 0; draw(); }
    host.classList.remove('is-awake'); void host.offsetWidth; host.classList.add('is-awake');
    reply.textContent = RESIDENTS[resident].replies[visits++ % RESIDENTS[resident].replies.length];
    host.dataset.visits = String(visits);
    onInteraction(resident);
    timer = setTimeout(() => { host.classList.remove('is-awake'); reply.textContent = ''; }, 4200);
  }
  const clicked = (event: MouseEvent) => {
    const control = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!control || !host.contains(control)) return;
    const next = control.dataset.camp as CampResident | undefined;
    greet(next);
  };
  host.addEventListener('click', clicked); draw();
  return {
    greet,
    destroy() { destroyed = true; clearTimeout(timer); host.removeEventListener('click', clicked); host.replaceChildren(); },
  };
}
