/** Small helper for building DOM safely (no innerHTML with user data). */
export function el(tag, { className, text, attributes = {}, on = {} } = {}, ...children) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  Object.entries(on).forEach(([eventName, handler]) => element.addEventListener(eventName, handler));
  children.forEach((child) => element.append(child));
  return element;
}
