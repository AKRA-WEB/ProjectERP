'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Th,
  Td,
  Badge,
  Modal,
  Card,
  CardBody
} from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { Search, Plus, Edit2, Loader2, ArrowLeft, Check, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

interface ProductChannelUom {
  id: string;
  product_id: string;
  channel: 'TRD' | 'AKRA';
  allowed_uoms: string[];
  created_at: string;
  updated_at: string;
  sku: string;
  name_th: string;
  name_en: string;
  base_uom_code: string;
}

interface UnitOfMeasure {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

interface Product {
  id: string;
  sku: string;
  name_th: string;
  name_en: string;
  uom_code?: string;
}

export default function ProductChannelUomsPage() {
  const t = useT();
  const [items, setItems] = useState<ProductChannelUom[]>([]);
  const [uoms, setUoms] = useState<UnitOfMeasure[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering / Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState('');

  // Modal / Editing states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'TRD' | 'AKRA'>('AKRA');
  const [selectedAllowedUoms, setSelectedAllowedUoms] = useState<string[]>([]);

  // Product search in Modal
  const [modalProductSearch, setModalProductSearch] = useState('');
  const [filteredModalProducts, setFilteredModalProducts] = useState<Product[]>([]);

  const fetchWhitelist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<ProductChannelUom[]>('/api/admin/product-channel-uoms');
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('channel_uom.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [uomData, prodData] = await Promise.all([
        get<UnitOfMeasure[]>('/api/products/uom'),
        get<{ data: Product[] }>('/api/products?limit=1000&is_active=true')
      ]);
      setUoms(uomData);
      setProducts(prodData.data || []);
    } catch (e) {
      console.error('Failed to load metadata', e);
    }
  }, []);

  useEffect(() => {
    fetchWhitelist();
    fetchMetadata();
  }, [fetchWhitelist, fetchMetadata]);

  useEffect(() => {
    if (!modalProductSearch) {
      setFilteredModalProducts([]);
      return;
    }
    const q = modalProductSearch.toLowerCase();
    const filtered = products.filter(
      p => p.sku.toLowerCase().includes(q) ||
           p.name_th.toLowerCase().includes(q) ||
           p.name_en.toLowerCase().includes(q)
    ).slice(0, 10);
    setFilteredModalProducts(filtered);
  }, [modalProductSearch, products]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setError(t('channel_uom.error_select_product'));
      return;
    }
    if (selectedAllowedUoms.length === 0) {
      setError(t('channel_uom.error_select_uom'));
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await patch('/api/admin/product-channel-uoms', {
        product_id: selectedProductId,
        channel: selectedChannel,
        allowed_uoms: selectedAllowedUoms,
      });

      setSuccess(t('channel_uom.save_success'));
      setShowModal(false);

      setSelectedProductId('');
      setSelectedAllowedUoms([]);
      setModalProductSearch('');

      await fetchWhitelist();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('channel_uom.error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (item: ProductChannelUom) => {
    setModalMode('edit');
    setSelectedProductId(item.product_id);
    setSelectedChannel(item.channel);
    setSelectedAllowedUoms(item.allowed_uoms || []);
    const productObj = products.find(p => p.id === item.product_id);
    setModalProductSearch(productObj ? `${productObj.sku} - ${productObj.name_th}` : item.sku);
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleCreateClick = () => {
    setModalMode('create');
    setSelectedProductId('');
    setSelectedChannel('AKRA');
    setSelectedAllowedUoms([]);
    setModalProductSearch('');
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const toggleUom = (code: string) => {
    const lowerCode = code.toLowerCase();
    if (selectedAllowedUoms.includes(lowerCode)) {
      setSelectedAllowedUoms(selectedAllowedUoms.filter(c => c !== lowerCode));
    } else {
      setSelectedAllowedUoms([...selectedAllowedUoms, lowerCode]);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_th.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_en.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesChannel = selectedChannelFilter === '' || item.channel === selectedChannelFilter;

    return matchesSearch && matchesChannel;
  });

  return (
    <DirectionalTransition>
      <div className="max-w-[1200px] mx-auto min-h-[calc(100vh-140px)] font-sans px-4 py-8">

        {/* Custom Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          .premium-input {
            border: 1px solid #d3cdbd;
            border-radius: 6px;
            background: #ffffff;
            transition: all 0.2s ease-in-out;
          }
          .premium-input:focus {
            border-color: #7a5a7e;
            box-shadow: 0 0 0 2px rgba(122,90,126,0.15);
            outline: none;
          }
          .uom-chip {
            transition: all 0.15s ease-in-out;
            cursor: pointer;
          }
          .uom-chip:hover {
            transform: scale(1.03);
          }
        ` }} />

        {/* Top Header Navigation */}
        <div className="mb-8 flex items-center justify-between border-b border-[#e4e0d6] pb-5">
          <div className="flex items-center gap-4">
            <Link
              href="/app/admin"
              className="p-2 border border-[#e4e0d6] hover:bg-stone-50 rounded-lg text-[#78716c] hover:text-[#7a5a7e] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7a5a7e] font-semibold mb-1">
                <span>ADMIN PORTAL</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7a5a7e]/40" />
                <span>WHOLE-CASE SYSTEM</span>
              </div>
              <h1 className="font-display text-[26px] font-semibold tracking-tight text-[#1c1917] m-0">
                {t('channel_uom.page.title')}
              </h1>
            </div>
          </div>
          <Button
            onClick={handleCreateClick}
            className="flex items-center gap-2 bg-[#7a5a7e] hover:bg-[#664b69] text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> {t('channel_uom.add_rule')}
          </Button>
        </div>

        {/* Action Notifications */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t('channel_uom.error_occurred')}</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-start gap-3 shadow-sm">
            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="mt-0.5">{success}</p>
            </div>
          </div>
        )}

        {/* Filter Card */}
        <Card className="mb-6 border-[#e4e0d6] shadow-sm">
          <CardBody className="p-5 flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('channel_uom.search_placeholder')}
                className="pl-9 premium-input w-full"
              />
            </div>

            <div className="w-full sm:w-60">
              <Select
                value={selectedChannelFilter}
                onChange={e => setSelectedChannelFilter(e.target.value)}
                className="premium-input w-full"
              >
                <option value="">{t('channel_uom.all_channels')}</option>
                <option value="AKRA">{t('channel_uom.filter.akra')}</option>
                <option value="TRD">{t('channel_uom.filter.trd')}</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Main Whitelist Table */}
        <div className="bg-white rounded-lg border border-[#e4e0d6] overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#7a5a7e] animate-spin" />
              <p>{t('channel_uom.loading')}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-stone-500 flex flex-col items-center justify-center gap-2">
              <X className="w-10 h-10 text-stone-300" />
              <p className="text-lg font-medium text-stone-700">{t('channel_uom.no_rules')}</p>
              <p className="text-sm text-stone-400">{t('channel_uom.no_rules_hint')}</p>
            </div>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th className="py-3.5 px-4 font-semibold text-stone-700">{t('channel_uom.col.product')}</Th>
                  <Th className="py-3.5 px-4 font-semibold text-stone-700">{t('channel_uom.col.channel')}</Th>
                  <Th className="py-3.5 px-4 font-semibold text-stone-700">{t('channel_uom.col.allowed_uoms')}</Th>
                  <Th className="py-3.5 px-4 font-semibold text-stone-700">{t('channel_uom.col.base_uom')}</Th>
                  <Th className="py-3.5 px-4 font-semibold text-stone-700">{t('channel_uom.col.updated_at')}</Th>
                  <Th className="py-3.5 px-4 text-right"></Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/60 border-b border-[#e8e4da]/60 transition-colors">
                    <Td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-semibold text-[#1c1917]">{item.sku}</span>
                        <span className="text-xs text-stone-600 font-medium mt-0.5">{item.name_th}</span>
                        <span className="text-[10px] text-stone-400 font-mono">{item.name_en}</span>
                      </div>
                    </Td>

                    <Td className="py-4 px-4">
                      {item.channel === 'AKRA' ? (
                        <Badge className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-xs font-semibold">
                          AKRA (Wholesale)
                        </Badge>
                      ) : (
                        <Badge className="bg-stone-100 text-stone-800 border border-stone-200 px-2 py-0.5 rounded text-xs font-semibold">
                          TRD (General)
                        </Badge>
                      )}
                    </Td>

                    <Td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {item.allowed_uoms && item.allowed_uoms.length > 0 ? (
                          item.allowed_uoms.map(uomCode => (
                            <span
                              key={uomCode}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-mono font-semibold"
                            >
                              {uomCode.toUpperCase()}
                            </span>
                          ))
                        ) : (
                          <span className="text-red-500 font-medium text-xs">🔴 {t('channel_uom.locked')}</span>
                        )}
                      </div>
                    </Td>

                    <Td className="py-4 px-4">
                      <span className="font-mono text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                        {item.base_uom_code?.toUpperCase()}
                      </span>
                    </Td>

                    <Td className="py-4 px-4 text-xs text-stone-500 font-mono">
                      {new Date(item.updated_at).toLocaleString('th-TH', { hour12: false })}
                    </Td>

                    <Td className="py-4 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(item)}
                        className="text-[#7a5a7e] hover:text-[#5a425d] hover:bg-[#7a5a7e]/5 transition-all flex items-center gap-1.5 ml-auto"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> {t('action.edit')}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>

        {/* Interactive Configuration Modal */}
        {showModal && (
          <Modal
            title={modalMode === 'create' ? t('channel_uom.modal.create_title') : t('channel_uom.modal.edit_title')}
            onClose={() => setShowModal(false)}
          >
            <form onSubmit={handleSave} className="space-y-6 pt-2">

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  {t('channel_uom.modal.select_product_label')} <span className="text-red-500">*</span>
                </label>

                {modalMode === 'create' ? (
                  <div className="relative">
                    <Input
                      value={modalProductSearch}
                      onChange={e => setModalProductSearch(e.target.value)}
                      placeholder={t('channel_uom.search_placeholder')}
                      className="premium-input w-full"
                    />

                    {filteredModalProducts.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white border border-[#e4e0d6] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-stone-100">
                        {filteredModalProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setModalProductSearch(`${p.sku} - ${p.name_th}`);
                              setFilteredModalProducts([]);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors flex flex-col"
                          >
                            <span className="font-mono text-sm font-semibold text-[#7a5a7e]">{p.sku}</span>
                            <span className="text-xs text-stone-600 mt-0.5">{p.name_th}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    value={modalProductSearch}
                    disabled
                    className="bg-stone-50 border-stone-200 text-stone-500 font-semibold cursor-not-allowed"
                  />
                )}
              </div>

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  {t('channel_uom.modal.channel_label')} <span className="text-red-500">*</span>
                </label>
                {modalMode === 'create' ? (
                  <Select
                    value={selectedChannel}
                    onChange={e => setSelectedChannel(e.target.value as 'TRD' | 'AKRA')}
                    className="premium-input w-full"
                  >
                    <option value="AKRA">{t('channel_uom.filter.akra')}</option>
                    <option value="TRD">{t('channel_uom.filter.trd')}</option>
                  </Select>
                ) : (
                  <Badge className="bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded text-sm font-semibold">
                    {selectedChannel === 'AKRA' ? 'AKRA (Wholesale)' : 'TRD (General)'}
                  </Badge>
                )}
              </div>

              {/* Whitelisted UoMs Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-stone-700">
                    {t('channel_uom.modal.uom_label')} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-stone-400 font-medium">
                    (Click to toggle)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-stone-50 rounded-lg border border-[#e8e4da]">
                  {uoms.map(uom => {
                    const isSelected = selectedAllowedUoms.includes(uom.code.toLowerCase());
                    return (
                      <button
                        key={uom.id}
                        type="button"
                        onClick={() => toggleUom(uom.code)}
                        className={`uom-chip flex items-center justify-between p-2.5 rounded-lg border text-left font-sans transition-all shadow-sm ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'bg-white border-[#d3cdbd] text-stone-700 hover:border-stone-400'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-bold">{uom.code.toUpperCase()}</span>
                          <span className="text-[10px] text-stone-500 mt-0.5">{uom.name_th}</span>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  className="hover:bg-stone-50"
                >
                  {t('action.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !selectedProductId || selectedAllowedUoms.length === 0}
                  className="bg-[#7a5a7e] hover:bg-[#664b69] text-white flex items-center gap-2 shadow-sm transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {t('channel_uom.modal.saving')}
                    </>
                  ) : (
                    t('channel_uom.modal.save_settings')
                  )}
                </Button>
              </div>

            </form>
          </Modal>
        )}

      </div>
    </DirectionalTransition>
  );
}
