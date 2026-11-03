import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Package, Trash2, Upload } from 'lucide-react';
import { Field } from './UI.jsx';

/** @typedef {import('../types.js').Product} Product */

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maximumFileSize = 8 * 1024 * 1024;
const maximumImageDimension = 1000;

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(/** @type {string} */(reader.result));
        reader.onerror = () => reject(new Error('The selected image could not be read.'));
        reader.readAsDataURL(file);
    });
}

/**
 * @param {string} source
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('The selected file is not a valid image.'));
        image.src = source;
    });
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function prepareImage(file) {
    if (!acceptedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
    if (file.size > maximumFileSize) throw new Error('Choose an image smaller than 8 MB.');

    const source = await readFile(file);
    const image = await loadImage(source);
    const scale = Math.min(1, maximumImageDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is not supported in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.82);
}

/** @param {{ product?: Product | null, size?: string, className?: string }} props */
export default function ProductImage({ product = null, size = 'medium', className = '' }) {
    const [failed, setFailed] = useState(false);
    const source = product?.image || '';

    useEffect(() => setFailed(false), [source]);

    return (
        <span className={`product-image product-image-${size} ${className}`.trim()}>
            {source && !failed ? (
                <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                <Package size={size === 'large' ? 30 : size === 'tiny' ? 15 : 19} aria-hidden="true" />
            )}
        </span>
    );
}

/** @param {{ product?: Product | null, name?: string, sku?: string | false, size?: string, className?: string }} props */
export function ProductCell({ product = null, name = '', sku = '', size = 'small', className = '' }) {
    return (
        <div className={`product-cell ${className}`.trim()}>
            <ProductImage product={product} size={size} />
            <div className="primary-cell">
                <strong>{name || product?.name || 'Removed product'}</strong>
                {sku !== false && <span className="monospace">{sku || product?.sku || '-'}</span>}
            </div>
        </div>
    );
}

/** @param {{ value: string, onChange: (value: string) => void }} props */
export function ProductImageUpload({ value, onChange }) {
    const inputId = useId();
    const inputRef = useRef(/** @type {HTMLInputElement | null} */(null));
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    const selectImage = async (/** @type {import('react').ChangeEvent<HTMLInputElement>} */ event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setError('');
        setProcessing(true);
        try {
            const image = await prepareImage(file);
            onChange(image);
        } catch (imageError) {
            setError(imageError instanceof Error ? imageError.message : 'The image could not be added.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Field
            label="Product Image (Optional)"
            error={error}
            hint="JPG, PNG or WebP up to 8 MB. Large images are resized for browser storage."
            className="product-image-field"
        >
            <div className={`product-image-uploader ${value ? 'has-image' : ''}`}>
                <div className="product-image-preview">
                    {value ? <img src={value} alt="Selected product preview" /> : <ImagePlus size={27} aria-hidden="true" />}
                </div>
                <div className="product-image-upload-copy">
                    <strong>{value ? 'Product image added' : 'Add a product image'}</strong>
                    <span>{value ? 'Replace or remove this image before saving.' : 'Help staff recognize this item in the catalog.'}</span>
                    <div className="product-image-upload-actions">
                        <button type="button" className="button button-secondary button-small" onClick={() => inputRef.current?.click()} disabled={processing}>
                            {processing ? <LoaderCircle size={16} className="product-image-spinner" /> : <Upload size={16} />}
                            {processing ? 'Processing image...' : value ? 'Replace image' : 'Choose image'}
                        </button>
                        {value && <button type="button" className="button button-danger-outline button-small" onClick={() => { onChange(''); setError(''); }} disabled={processing}><Trash2 size={15} />Remove</button>}
                    </div>
                </div>
            </div>
            <input
                ref={inputRef}
                id={inputId}
                className="product-image-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={selectImage}
                tabIndex={-1}
                aria-label="Choose product image"
            />
        </Field>
    );
}