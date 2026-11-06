import {getCode39Bars} from '../utils/barcode.js';

/** @param {{ value: string, className?: string }} props */
export default function Code39Barcode({value, className = ''}) {
    const barcode = getCode39Bars(value);
    return (
        <div className={`code39-barcode ${className}`}>
            <svg viewBox={`0 0 ${barcode.width} 46`} role="img" aria-label={`Barcode for ${barcode.value}`}
                 preserveAspectRatio="xMidYMid meet">
                {barcode.bars.map((bar, index) => <rect key={`${bar.x}-${index}`} x={bar.x} y="0" width={bar.width}
                                                        height="46"/>)}
            </svg>
            <strong>{barcode.value}</strong>
        </div>
    );
}