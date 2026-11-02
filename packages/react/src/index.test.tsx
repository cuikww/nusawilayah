import { createWilayah } from '@nusawilayah/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { labelsEn, WilayahPicker, type FieldProps } from './index.tsx';

const files: Record<string, unknown> = {
  'provinsi.json': [['51', 'Bali'], ['52', 'Nusa Tenggara Barat']],
  'kabupaten/51.json': [['51.03', 'Kabupaten Badung']],
  'kecamatan/51.03.json': [['51.03.01', 'Kuta']],
  'desa/51.03.01.json': [['51.03.01.1001', 'Tuban', '80361']],
};
const makeClient = (fail = new Set<string>()) =>
  createWilayah({
    fetcher: async (path) => {
      if (fail.has(path)) throw new Error('offline');
      return files[path];
    },
  });

afterEach(cleanup);

const pick = async (label: string, value: string) => {
  const select = screen.getByLabelText(label) as HTMLSelectElement;
  await waitFor(() => expect(select.querySelector(`option[value="${value}"]`)).not.toBeNull());
  await act(async () => { fireEvent.change(select, { target: { value } }); });
};

describe('WilayahPicker', () => {
  it('cascades through 4 levels and reports a full Alamat', async () => {
    const onChange = vi.fn();
    const { container } = render(<WilayahPicker client={makeClient()} onChange={onChange} name="alamat" />);

    expect(screen.getByLabelText('Kabupaten/Kota')).toHaveProperty('disabled', true);
    await pick('Provinsi', '51');
    await pick('Kabupaten/Kota', '51.03');
    await pick('Kecamatan', '51.03.01');
    await pick('Desa/Kelurahan', '51.03.01.1001');

    const alamat = onChange.mock.lastCall![0];
    expect([alamat.provinsi.nama, alamat.desa.nama, alamat.kodePos]).toEqual(['Bali', 'Tuban', '80361']);
    expect(screen.getByLabelText('Kode Pos')).toHaveProperty('value', '80361');
    const hidden = Object.fromEntries([...container.querySelectorAll('input[type=hidden]')].map((i) => [(i as HTMLInputElement).name, (i as HTMLInputElement).value]));
    expect(hidden).toEqual({ alamat: '51.03.01.1001', alamat_kodepos: '80361' });

    // changing provinsi clears the levels below
    await pick('Provinsi', '52');
    expect(screen.getByLabelText('Kecamatan')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Kode Pos')).toHaveProperty('value', '');
  });

  it('loads a saved kode for edit forms (defaultValue)', async () => {
    render(<WilayahPicker client={makeClient()} defaultValue="51.03.01.1001" />);
    await waitFor(() => expect(screen.getByLabelText('Desa/Kelurahan')).toHaveProperty('value', '51.03.01.1001'));
    expect(screen.getByLabelText('Provinsi')).toHaveProperty('value', '51');
  });

  it('follows a controlled value, including clearing it', async () => {
    const client = makeClient();
    const { rerender } = render(<WilayahPicker client={client} value="51.03" levels={2} />);
    await waitFor(() => expect(screen.getByLabelText('Kabupaten/Kota')).toHaveProperty('value', '51.03'));
    expect(screen.queryByLabelText('Kecamatan')).toBeNull();
    expect(screen.queryByLabelText('Kode Pos')).toBeNull();
    rerender(<WilayahPicker client={client} value={null} levels={2} />);
    await waitFor(() => expect(screen.getByLabelText('Provinsi')).toHaveProperty('value', ''));
  });

  it('shows an error per dropdown with a working retry', async () => {
    const fail = new Set(['kabupaten/51.json']);
    render(<WilayahPicker client={makeClient(fail)} labels={labelsEn} />);
    await pick('Province', '51');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('offline');
    expect(screen.getByLabelText('Regency/City').getAttribute('aria-describedby')).toBe(alert.id);
    fail.clear();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    expect(screen.queryByRole('alert')).toBeNull();
    await pick('Regency/City', '51.03');
  });

  it('lets apps swap in their own field component', async () => {
    const Field = (p: FieldProps) => <button data-testid={p.level} data-count={p.options.length} onClick={() => p.onChange(p.options[0]?.kode)}>{p.value || p.placeholder}</button>;
    render(<WilayahPicker client={makeClient()} components={{ Field }} levels={2} placeholder={{ provinsi: 'Provinsi?' }} />);
    expect(screen.getByTestId('provinsi').textContent).toBe('Provinsi?');
    await waitFor(() => expect(screen.getByTestId('provinsi').dataset.count).toBe('2'));
    await act(async () => { fireEvent.click(screen.getByTestId('provinsi')); });
    await waitFor(() => expect(screen.getByTestId('provinsi').textContent).toBe('51'));
  });
});
