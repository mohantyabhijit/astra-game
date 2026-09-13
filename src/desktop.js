import './style.css';

const mobileDevice = navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (mobileDevice) {
  const message=document.createElement('main');message.id='desktop-required';
  const title=document.createElement('h1');title.textContent='Play on desktop';
  const copy=document.createElement('p');copy.textContent='Wobble City requires a desktop or laptop with a keyboard. Open this link in a desktop browser to play.';
  message.append(title,copy);document.body.replaceChildren(message);
} else {
  import('./main.js');
}
