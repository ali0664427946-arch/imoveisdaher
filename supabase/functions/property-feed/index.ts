const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from "npm:@supabase/supabase-js@2";

function escapeXml(str: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(str: string | null): string {
  if (!str) return '';
  return `<![CDATA[${str}]]>`;
}

function mapPropertyType(type: string, purpose: string): string {
  const typeMap: Record<string, string> = {
    'apartamento': 'Residential / Apartment',
    'casa': 'Residential / Home',
    'casa de condomínio': 'Residential / Condo',
    'cobertura': 'Residential / Penthouse',
    'flat': 'Residential / Flat',
    'kitnet': 'Residential / Kitnet',
    'loft': 'Residential / Loft',
    'terreno': 'Residential / Land Lot',
    'sobrado': 'Residential / Sobrado',
    'sala comercial': 'Commercial / Building',
    'loja': 'Commercial / Store',
    'galpão': 'Commercial / Warehouse',
    'ponto comercial': 'Commercial / Store',
  };
  
  const normalized = type.toLowerCase().trim();
  return typeMap[normalized] || 'Residential / Apartment';
}

function stateAbbreviation(state: string): string {
  const stateMap: Record<string, string> = {
    'rio de janeiro': 'RJ', 'são paulo': 'SP', 'minas gerais': 'MG',
    'bahia': 'BA', 'paraná': 'PR', 'rio grande do sul': 'RS',
    'pernambuco': 'PE', 'ceará': 'CE', 'pará': 'PA',
    'santa catarina': 'SC', 'goiás': 'GO', 'maranhão': 'MA',
    'amazonas': 'AM', 'espírito santo': 'ES', 'paraíba': 'PB',
    'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    'distrito federal': 'DF', 'alagoas': 'AL', 'piauí': 'PI',
    'sergipe': 'SE', 'rondônia': 'RO', 'tocantins': 'TO',
    'acre': 'AC', 'amapá': 'AP', 'roraima': 'RR',
  };
  
  if (state.length === 2) return state.toUpperCase();
  return stateMap[state.toLowerCase()] || state;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch only active properties with photos
    const { data: properties, error } = await supabase
      .from('properties')
      .select(`
        *,
        photos:property_photos(url, sort_order)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get contact info from settings
    const { data: contactSettings } = await supabase
      .from('integrations_settings')
      .select('value')
      .eq('key', 'feed_contact_info')
      .maybeSingle();

    const contact = (contactSettings?.value as Record<string, string>) || {
      name: 'Daher Imóveis',
      email: 'contato@daherimoveis.com.br',
      phone: '(21) 99999-9999',
      website: 'https://imoveisdaher.lovable.app',
    };

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <PublishDate>${new Date().toISOString()}</PublishDate>
  </Header>
  <Listings>`;

    for (const prop of (properties || [])) {
      const photos = (prop.photos || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      const transactionType = prop.purpose === 'sale' ? 'For Sale' : 'For Rent';
      const stateAbbr = stateAbbreviation(prop.state || 'RJ');
      const propertyType = mapPropertyType(prop.type, prop.purpose);
      
      // Description must be 50-3000 chars
      let description = prop.description || prop.title;
      if (description.length < 50) {
        description = description + ' - ' + `${prop.type} ${prop.purpose === 'rent' ? 'para alugar' : 'à venda'} em ${prop.neighborhood}, ${prop.city}. ${prop.bedrooms || 0} quartos, ${prop.bathrooms || 0} banheiros, ${prop.area || 0}m².`;
      }
      if (description.length > 3000) {
        description = description.substring(0, 3000);
      }

      xml += `
    <Listing>
      <ListingID>${escapeXml(prop.id)}</ListingID>
      <Title>${cdata(prop.title)}</Title>
      <TransactionType>${transactionType}</TransactionType>
      <PublicationType>${prop.featured ? 'PREMIUM' : 'STANDARD'}</PublicationType>
      <Details>
        <PropertyType>${propertyType}</PropertyType>
        <Description>${cdata(description)}</Description>`;

      if (prop.purpose === 'sale') {
        xml += `
        <ListPrice currency="BRL">${Math.round(prop.price)}</ListPrice>`;
      } else {
        xml += `
        <RentalPrice currency="BRL" period="Monthly">${Math.round(prop.price)}</RentalPrice>`;
      }

      if (prop.condominio && prop.condominio > 0) {
        xml += `
        <PropertyAdministrationFee currency="BRL">${Math.round(prop.condominio)}</PropertyAdministrationFee>`;
      }
      if (prop.iptu && prop.iptu > 0) {
        xml += `
        <YearlyTax currency="BRL">${Math.round(prop.iptu)}</YearlyTax>`;
      }

      if (prop.area) {
        const areaType = ['terreno', 'lote'].includes((prop.type || '').toLowerCase()) ? 'LotArea' : 'LivingArea';
        xml += `
        <${areaType} unit="square metres">${Math.round(prop.area)}</${areaType}>`;
      }
      if (prop.bedrooms) {
        xml += `
        <Bedrooms>${prop.bedrooms}</Bedrooms>`;
      }
      if (prop.bathrooms) {
        xml += `
        <Bathrooms>${prop.bathrooms}</Bathrooms>`;
      }
      if (prop.parking) {
        xml += `
        <Garage type="Parking Spaces">${prop.parking}</Garage>`;
      }

      // Features
      const features = prop.features || {};
      const featureKeys = Object.keys(features).filter(k => features[k] === true);
      if (featureKeys.length > 0) {
        xml += `
        <Features>`;
        // Map feature keys to VRSync feature names
        const featureMap: Record<string, string> = {
          'area_servico': 'Laundry Area',
          'ar_condicionado': 'Air Conditioning',
          'armarios_quarto': 'Bedroom Closets',
          'armarios_cozinha': 'Kitchen Cabinets',
          'churrasqueira': 'BBQ',
          'quarto_servico': 'Service Room',
          'varanda': 'Balcony',
          'piscina': 'Pool',
          'sauna': 'Sauna',
          'academia': 'Gym',
          'playground': 'Playground',
          'salao_festas': 'Party Room',
          'salao_jogos': 'Game Room',
          'espaco_gourmet': 'Gourmet Area',
          'quadra': 'Sports Court',
          'condominio_fechado': 'Gated Community',
          'portaria_24h': '24-Hour Concierge',
          'seguranca_24h': '24-Hour Security',
          'elevador': 'Elevator',
          'permitido_animais': 'Pets Allowed',
        };
        for (const key of featureKeys) {
          const featureName = featureMap[key] || key;
          xml += `
          <Feature>${escapeXml(featureName)}</Feature>`;
        }
        xml += `
        </Features>`;
      }

      xml += `
      </Details>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="${stateAbbr}">${cdata(prop.state || 'RJ')}</State>
        <City>${cdata(prop.city)}</City>
        <Neighborhood>${cdata(prop.neighborhood)}</Neighborhood>`;

      if (prop.address) {
        xml += `
        <Address>${cdata(prop.address)}</Address>`;
      }
      if (prop.cep) {
        xml += `
        <PostalCode>${escapeXml(prop.cep)}</PostalCode>`;
      }

      xml += `
      </Location>`;

      // Media
      if (photos.length > 0) {
        xml += `
      <Media>`;
        photos.forEach((photo: any, index: number) => {
          xml += `
        <Item medium="image" caption="img${index + 1}"${index === 0 ? ' primary="true"' : ''}>${escapeXml(photo.url)}</Item>`;
        });
        if (prop.youtube_url) {
          xml += `
        <Item medium="video">${escapeXml(prop.youtube_url)}</Item>`;
        }
        xml += `
      </Media>`;
      }

      xml += `
      <ContactInfo>
        <Name>${cdata(contact.name)}</Name>
        <Email>${escapeXml(contact.email)}</Email>`;
      if (contact.phone) {
        xml += `
        <Telephone>${escapeXml(contact.phone)}</Telephone>`;
      }
      if (contact.website) {
        xml += `
        <Website>${escapeXml(contact.website)}</Website>`;
      }
      xml += `
      </ContactInfo>
    </Listing>`;
    }

    xml += `
  </Listings>
</ListingDataFeed>`;

    console.log(`Feed generated: ${(properties || []).length} active properties`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating feed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><error>${errorMessage}</error>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    });
  }
});
