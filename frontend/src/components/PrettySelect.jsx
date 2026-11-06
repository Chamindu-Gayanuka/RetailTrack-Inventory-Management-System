import {Children, isValidElement, useEffect, useId, useRef, useState} from 'react';
import {Check, ChevronDown} from 'lucide-react';
import {createPortal} from 'react-dom';
import useFloatingMenu from '../utils/useFloatingMenu.js';

/**
 * A styled select that accepts the same option children and onChange(value)
 * pattern as the native selects it replaces.
 *
 * @param {{ value?: string | number, onChange?: (event: any) => void, children?: import('react').ReactNode, disabled?: boolean, className?: string, [key: string]: any }} props
 */
export default function PrettySelect({
                                         value = '',
                                         onChange,
                                         children,
                                         disabled = false,
                                         className = '',
                                         ...buttonProps
                                     }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
    const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
    const menuRef = useRef(/** @type {HTMLDivElement | null} */ (null));
    const menuId = useId();

    const options = Children.toArray(children).flatMap((child) => {
        if (!isValidElement(child)) return [];
        const props = /** @type {{ value?: string | number, disabled?: boolean, children?: import('react').ReactNode }} */ (child.props);
        return [{
            value: String(props.value ?? props.children ?? ''),
            label: props.children,
            disabled: Boolean(props.disabled)
        }];
    });
    const selected = options.find((option) => option.value === String(value));
    const menuStyle = useFloatingMenu(open, triggerRef, menuRef, `${value}-${options.length}`, {
        minWidth: 180,
        maxWidth: 340,
        maxHeight: 330
    });
    const focusOption = (/** @type {number} */ index, /** @type {boolean} */ preventScroll = false) => {
        const element = menuRef.current?.querySelector(`[data-option-index="${index}"]`);
        if (element instanceof HTMLElement) element.focus({preventScroll});
    };

    useEffect(() => {
        if (!open) return undefined;
        const close = (/** @type {MouseEvent} */ event) => {
            const target = /** @type {Node | null} */ (event.target);
            if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const index = Math.max(0, options.findIndex((option) => option.value === String(value) && !option.disabled));
        focusOption(index, true);
    }, [open]);

    const choose = (/** @type {string} */ nextValue) => {
        onChange?.({target: {value: nextValue}, currentTarget: {value: nextValue}});
        setOpen(false);
        triggerRef.current?.focus({preventScroll: true});
    };

    const onKeyDown = (/** @type {import('react').KeyboardEvent<HTMLDivElement>} */ event) => {
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (event.key === 'Tab') {
            setOpen(false);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (!open) {
            setOpen(true);
            return;
        }
        const enabled = options.map((option, index) => !option.disabled ? index : -1).filter((index) => index >= 0);
        if (!enabled.length) return;
        const activeIndex = Number(document.activeElement?.getAttribute('data-option-index'));
        const position = enabled.indexOf(activeIndex);
        let next = enabled[0];
        if (event.key === 'End') next = enabled[enabled.length - 1];
        else if (event.key === 'ArrowDown') next = enabled[(position + 1 + enabled.length) % enabled.length];
        else if (event.key === 'ArrowUp') next = enabled[(position - 1 + enabled.length) % enabled.length];
        focusOption(next);
    };

    return (
        <div className={`pretty-select ${className}`} ref={rootRef} onKeyDown={onKeyDown}>
            <button
                {...buttonProps}
                type="button"
                className={`pretty-select-trigger ${open ? 'open' : ''}`}
                ref={triggerRef}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((current) => !current)}
            >
                <span className={selected ? '' : 'placeholder'}>{selected?.label || 'Select an option'}</span>
                <ChevronDown size={16} className={open ? 'rotate' : ''}/>
            </button>
            {open && createPortal(
                <div className="pretty-select-menu" id={menuId} ref={menuRef} role="listbox" style={menuStyle}>
                    {options.map((option, index) => (
                        <button
                            type="button"
                            role="option"
                            aria-selected={option.value === String(value)}
                            data-option-index={index}
                            key={`${option.value}-${index}`}
                            className={option.value === String(value) ? 'selected' : ''}
                            disabled={option.disabled}
                            onClick={() => choose(option.value)}
                        >
                            <span>{option.label}</span>
                            {option.value === String(value) && <Check size={16}/>}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </div>
    );
}