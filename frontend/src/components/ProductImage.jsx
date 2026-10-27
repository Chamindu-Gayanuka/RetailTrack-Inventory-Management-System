import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Package, Trash2, Upload } from 'lucide-react';
import { Field } from './UI.jsx';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maximumFileSize = 8 * 1024 * 1024;
const maximumImageDimension = 1000;

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The selected image could not be read.'));
        reader.readAsDataURL(file);
    });
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('The selected file is not a valid image.'));
        image.src = source;
    });
}

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

export default function ProductImage({ product, size = 'medium', className = '' }) {
    const [failed, setFailed] = useState(false);
    const source = product?.image || '';

    useEffect(() => setFailed(false), [source]);

    return (
        <span className={`product-image product-image-${size} ${className}`.trim()}>
            {source && !failed ? (
                <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                <Package size={size === 'large' ? 30 : 19} aria-hidden="true" />
            )}
        </span>
    );
}

export function ProductImageUpload({ value, onChange }) {
    const inputId = useId();
    const inputRef = useRef(null);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    const selectImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setError('');
        setProcessing(true);
        try {
            const image = await prepareImage(file);
            onChange(image);
        } catch (imageError) {
            setError(imageError.message || 'The image could not be added.');
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