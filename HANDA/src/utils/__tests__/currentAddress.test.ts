import { findBinanBarangay, formatCurrentAddress, isBinanCity, isCurrentAddressComplete, parseCurrentAddress } from '../currentAddress';

describe('current address formatting', () => {
  it('resolves a known barangay from reverse-geocoded district labels only', () => {
    expect(findBinanBarangay('Barangay Canlalay, Biñan City')).toBe('Canlalay');
    expect(findBinanBarangay('Biñan City', 'Laguna')).toBeUndefined();
  });

  it('distinguishes Biñan from surrounding cities', () => {
    expect(isBinanCity('Biñan City')).toBe(true);
    expect(isBinanCity('Biñan')).toBe(true);
    expect(isBinanCity('Santa Rosa City')).toBe(false);
    expect(isBinanCity('Cabuyao')).toBe(false);
  });

  it('formats the address fields with Biñan City and omits an empty village', () => {
    const address = {
      houseNumber: '12A',
      street: 'Rizal Street',
      village: '',
      barangay: 'San Francisco (Halang)',
    };

    expect(formatCurrentAddress(address)).toBe('12A, Rizal Street, Brgy. San Francisco (Halang), Biñan City');
    expect(isCurrentAddressComplete(address)).toBe(true);
  });

  it('round-trips an address with a village or subdivision', () => {
    const address = {
      houseNumber: 'Block 4 Lot 8',
      street: 'Acacia Avenue',
      village: 'Southville 5A',
      barangay: 'Langkiwa',
    };

    expect(parseCurrentAddress(formatCurrentAddress(address))).toEqual(address);
  });

  it('allows an empty street while still requiring a house number and barangay', () => {
    const address = {
      houseNumber: '12A',
      street: '',
      village: 'Purok 4',
      barangay: 'Canlalay',
    };

    expect(isCurrentAddressComplete(address)).toBe(true);
    expect(formatCurrentAddress(address)).toBe('12A, Purok 4, Brgy. Canlalay, Biñan City');
    expect(isCurrentAddressComplete({ ...address, houseNumber: '' })).toBe(false);
    expect(isCurrentAddressComplete({ ...address, barangay: '' })).toBe(false);
  });

  it('keeps a legacy street line and recognizes its barangay', () => {
    expect(parseCurrentAddress('28 Rizal Street, Brgy. Canlalay, Biñan City')).toEqual({
      houseNumber: '',
      street: '28 Rizal Street',
      village: '',
      barangay: 'Canlalay',
    });
  });

  it('preserves an unstructured existing address for editing', () => {
    expect(parseCurrentAddress('Unit 3, 10 Main Road, Santa Rosa')).toMatchObject({
      street: 'Unit 3, 10 Main Road, Santa Rosa',
      barangay: '',
    });
  });
});
