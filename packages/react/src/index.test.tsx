import { createWilayah } from '@nusawilayah/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { labelsEn, WilayahPicker, type FieldProps } from './index.ts';

const files: Record<string, unknown> = {
  'provinsi.json': [['51', 'Bali'], ['52', 'Nusa Tenggara Barat']],
  'kabupaten/51.json': [['51.03', 'Kabupaten Badung']],
  'kecamatan/51.03.json': [['51.03.01', 'Kuta']],
  'desa/51.03.01.json': [['51.03.01.1001', 'Tuban', '80361'], ['51.03.01.1002', 'Kuta', '80361']],
  'search/nasional.json': [['51', 'Bali'], ['51.03', 'Kabupaten Badung'], ['51.03.01', 'Kuta'], ['51.03.06', 'Mengwi', 'Mengui'], ['52', 'Nusa Tenggara Barat']],
  'search/51.json': [['51.03.01.1001', 'Tuban'], ['51.03.01.1002', 'Kuta']],
  'kodepos/80.json': { '80361': [['51.03.01.1001', 'Tuban'], ['51.03.01.1002', 'Kuta']] },
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

  it('lets the user correct the kode pos', async () => {
    const onChange = vi.fn();
    const { container } = render(<WilayahPicker client={makeClient()} defaultValue="51.03.01.1001" onChange={onChange} name="alamat" />);
    const kodePos = screen.getByLabelText('Kode Pos') as HTMLInputElement;
    await waitFor(() => expect(kodePos.value).toBe('80361'));
    await act(async () => { fireEvent.change(kodePos, { target: { value: '80-362x9' } }); });
    expect(kodePos.value).toBe('80362');
    expect(onChange.mock.lastCall![0].kodePos).toBe('80362');
    expect((container.querySelector('input[name=alamat_kodepos]') as HTMLInputElement).value).toBe('80362');
  });

  it('renders server-loaded provinsi on the server, without fetching', async () => {
    const provinsi = await makeClient().provinsi();
    const fetcher = vi.fn();
    const html = renderToString(<WilayahPicker client={createWilayah({ fetcher })} initialProvinsi={provinsi} />);
    expect(html).toContain('<option value="51">Bali</option>');
    expect(fetcher).not.toHaveBeenCalled();
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

describe('WilayahPicker mode="search"', () => {
  const type = async (text: string) => {
    await act(async () => { fireEvent.change(screen.getByRole('combobox'), { target: { value: text } }); });
  };

  it('searches as you type and picks with the keyboard', async () => {
    const onChange = vi.fn();
    render(<WilayahPicker client={makeClient()} mode="search" onChange={onChange} name="alamat" />);
    const input = screen.getByRole('combobox');
    expect(screen.getByRole('combobox', { name: 'Cari wilayah' })).toBe(input);

    await type('kuta');
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Kuta, Badung, Bali', 'Kuta, Kuta, Badung, Bali']));
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const alamat = onChange.mock.lastCall![0];
    expect([alamat.desa.nama, alamat.kodePos]).toEqual(['Kuta', '80361']);
    expect(input).toHaveProperty('value', 'Kuta, Kuta, Badung, Bali');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('Kode Pos')).toHaveProperty('value', '80361');
  });

  it('shows the former name a result was found by', async () => {
    render(<WilayahPicker client={makeClient()} mode="search" labels={labelsEn} />);
    await type('mengui');
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Mengwi, Badung, Bali (formerly Mengui)']));
  });

  it('finds desa by kode pos and lets the user choose with the mouse', async () => {
    render(<WilayahPicker client={makeClient()} mode="search" />);
    await type('80361');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    await act(async () => { fireEvent.mouseDown(screen.getByText('Tuban, Kuta, Badung, Bali')); });
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveProperty('value', 'Tuban, Kuta, Badung, Bali'));
  });

  it('shows the saved value, announces no results, and restores on Escape', async () => {
    render(<WilayahPicker client={makeClient()} mode="search" defaultValue="51.03" levels={2} />);
    const input = screen.getByRole('combobox');
    await waitFor(() => expect(input).toHaveProperty('value', 'Badung, Bali'));
    await type('xyz');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Wilayah tidak ditemukan'));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveProperty('value', 'Badung, Bali');
  });

  it('reports a failed index load with retry', async () => {
    const fail = new Set(['search/nasional.json']);
    render(<WilayahPicker client={makeClient(fail)} mode="search" />);
    await type('kuta');
    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    fail.clear();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' })); });
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
  });
});
