// Create an empty vector source for imported KML features.
var vectorSource = new ol.source.Vector();

// Create the vector layer without a general style function
// so that imported inline KML styles are used initially.
var vectorLayer = new ol.layer.Vector({
  source: vectorSource
});

// Initialize the map with a base OSM tile layer and the vector layer.
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({ source: new ol.source.OSM() }),
    vectorLayer
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([0, 0]),
    zoom: 2
  })
});

// Store styles information
let styleData = {
  points: [],
  lines: [],
  polygons: []
};

// Store original KML content and document
let originalKmlContent = '';
let originalKmlFilename = '';
let originalKmlDoc = null;
let styleMapData = {}; // Store StyleMap relationships

// Convert a KML color (aabbggrr) to a standard hex color (#rrggbb).
// This also let us extract the alpha value from the first two digits.
function convertKmlToHex(kmlColor) {
  if (!kmlColor || kmlColor.length !== 8) return '#000000';
  var red   = kmlColor.substr(6, 2);
  var green = kmlColor.substr(4, 2);
  var blue  = kmlColor.substr(2, 2);
  return '#' + red + green + blue;
}

// Extract alpha value from KML color
function extractAlpha(kmlColor) {
  if (!kmlColor || kmlColor.length !== 8) return 1;
  return parseInt(kmlColor.substr(0, 2), 16) / 255;
}

// Helper function to convert hex color to an rgba string with the provided opacity.
function hexToRGBA(hex, opacity) {
  var r = parseInt(hex.substr(1, 2), 16);
  var g = parseInt(hex.substr(3, 2), 16);
  var b = parseInt(hex.substr(5, 2), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + opacity + ")";
}

// Read styles from the imported KML and update the control panel.
function readKmlStyles(kmlText) {
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  originalKmlDoc = xmlDoc;
  
  // Reset style data
  styleData = {
    points: [],
    lines: [],
    polygons: []
  };
  styleMapData = {};
  
  // Process StyleMap elements first
  var styleMapElements = xmlDoc.getElementsByTagName('StyleMap');
  for (let i = 0; i < styleMapElements.length; i++) {
    const styleMapElement = styleMapElements[i];
    const styleMapId = styleMapElement.getAttribute('id');
    
    if (styleMapId) {
      styleMapData[styleMapId] = {};
      
      // Get all Pair elements within this StyleMap
      const pairElements = styleMapElement.getElementsByTagName('Pair');
      for (let j = 0; j < pairElements.length; j++) {
        const pairElement = pairElements[j];
        const keyElement = pairElement.getElementsByTagName('key')[0];
        const styleUrlElement = pairElement.getElementsByTagName('styleUrl')[0];
        
        if (keyElement && styleUrlElement) {
          const key = keyElement.textContent.trim();
          let styleUrl = styleUrlElement.textContent.trim();
          
          // Remove # from styleUrl if present
          if (styleUrl.startsWith('#')) {
            styleUrl = styleUrl.substring(1);
          }
          
          styleMapData[styleMapId][key] = styleUrl;
        }
      }
    }
  }

  // Get all Style elements
  var styleElements = xmlDoc.getElementsByTagName('Style');
  
  for (let i = 0; i < styleElements.length; i++) {
    const styleElement = styleElements[i];
    const styleId = styleElement.getAttribute('id') || `style_${i+1}`;
    
    // Process IconStyle (Points)
    const iconStyle = styleElement.getElementsByTagName('IconStyle')[0];
    if (iconStyle) {
      let pointStyle = {
        id: styleId,
        iconUrl: "",
        iconScale: 1,
        iconHeading: 0,
        iconColor: "#ffffff",
        labelEnabled: false,
        labelColor: "#000000",
        labelScale: 1
      };
      
      // Extract icon URL
      const iconElem = iconStyle.getElementsByTagName('Icon')[0];
      if (iconElem) {
        const hrefElem = iconElem.getElementsByTagName('href')[0];
        if (hrefElem && hrefElem.textContent) {
          pointStyle.iconUrl = hrefElem.textContent.trim();
        }
      }
      
      // Extract scale
      const scaleElem = iconStyle.getElementsByTagName('scale')[0];
      if (scaleElem && scaleElem.textContent) {
        pointStyle.iconScale = parseFloat(scaleElem.textContent.trim());
      }
      
      // Extract heading
      const headingElem = iconStyle.getElementsByTagName('heading')[0];
      if (headingElem && headingElem.textContent) {
        pointStyle.iconHeading = parseFloat(headingElem.textContent.trim());
      }
      
      // Extract color
      const iconColorElem = iconStyle.getElementsByTagName('color')[0];
      if (iconColorElem && iconColorElem.textContent) {
        pointStyle.iconColor = convertKmlToHex(iconColorElem.textContent.trim());
      }
      
      // Check for LabelStyle
      const labelStyle = styleElement.getElementsByTagName('LabelStyle')[0];
      if (labelStyle) {
        const labelScaleElem = labelStyle.getElementsByTagName('scale')[0];
        if (labelScaleElem && labelScaleElem.textContent) {
          const labelScale = parseFloat(labelScaleElem.textContent.trim());
          // Only enable label if scale is greater than 0
          if (labelScale > 0) {
            pointStyle.labelEnabled = true;
            pointStyle.labelScale = labelScale;
          }
        } else {
          pointStyle.labelEnabled = true;
        }
        
        const labelColorElem = labelStyle.getElementsByTagName('color')[0];
        if (labelColorElem && labelColorElem.textContent) {
          pointStyle.labelColor = convertKmlToHex(labelColorElem.textContent.trim());
        }
      }
      
      styleData.points.push(pointStyle);
    }
    
    // Process LineStyle
    const lineStyle = styleElement.getElementsByTagName('LineStyle')[0];
    if (lineStyle) {
      let lineStyleData = {
        id: styleId,
        lineColor: "#000000",
        lineWidth: 1,
        lineOpacity: 1
      };
      
      const lineColorElem = lineStyle.getElementsByTagName('color')[0];
      if (lineColorElem && lineColorElem.textContent) {
        const kmlColor = lineColorElem.textContent.trim();
        lineStyleData.lineColor = convertKmlToHex(kmlColor);
        lineStyleData.lineOpacity = extractAlpha(kmlColor);
      }
      
      const widthElem = lineStyle.getElementsByTagName('width')[0];
      if (widthElem && widthElem.textContent) {
        lineStyleData.lineWidth = parseInt(widthElem.textContent.trim(), 10);
      }
      
      // Only add line style if it's not already part of a polygon style
      if (!styleElement.getElementsByTagName('PolyStyle')[0]) {
        styleData.lines.push(lineStyleData);
      }
    }
    
    // Process PolyStyle
    const polyStyle = styleElement.getElementsByTagName('PolyStyle')[0];
    if (polyStyle) {
      let polyStyleData = {
        id: styleId,
        fillColor: "#ffffff",
        fillOpacity: 1,
        polyFill: true,
        polyOutline: true,
        lineColor: "#000000",
        lineWidth: 1,
        lineOpacity: 1
      };
      
      const fillColorElem = polyStyle.getElementsByTagName('color')[0];
      if (fillColorElem && fillColorElem.textContent) {
        const kmlColor = fillColorElem.textContent.trim();
        polyStyleData.fillColor = convertKmlToHex(kmlColor);
        polyStyleData.fillOpacity = extractAlpha(kmlColor);
      }
      
      const fillElem = polyStyle.getElementsByTagName('fill')[0];
      if (fillElem && fillElem.textContent) {
        polyStyleData.polyFill = (parseInt(fillElem.textContent.trim(), 10) !== 0);
      }
      
      const outlineElem = polyStyle.getElementsByTagName('outline')[0];
      if (outlineElem && outlineElem.textContent) {
        polyStyleData.polyOutline = (parseInt(outlineElem.textContent.trim(), 10) !== 0);
      }
      
      // If there's a LineStyle, use it for the polygon outline
      if (lineStyle) {
        const lineColorElem = lineStyle.getElementsByTagName('color')[0];
        if (lineColorElem && lineColorElem.textContent) {
          const kmlColor = lineColorElem.textContent.trim();
          polyStyleData.lineColor = convertKmlToHex(kmlColor);
          polyStyleData.lineOpacity = extractAlpha(kmlColor);
        }
        
        const widthElem = lineStyle.getElementsByTagName('width')[0];
        if (widthElem && widthElem.textContent) {
          polyStyleData.lineWidth = parseInt(widthElem.textContent.trim(), 10);
        }
      }
      
      styleData.polygons.push(polyStyleData);
    }
  }
  
  // Generate the style controls
  generateStyleControls();
}

// Generate style control panels based on the styleData
function generateStyleControls() {
  const styleControls = document.getElementById('styleControls');
  styleControls.innerHTML = '';
  
  // If no styles were found, show a message
  if (styleData.points.length === 0 && styleData.lines.length === 0 && styleData.polygons.length === 0) {
    styleControls.innerHTML = '<p class="no-styles">No styles found in the imported KML file.</p>';
    return;
  }
  
  // Generate point style controls
  if (styleData.points.length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Point Styles</div>';
    
    styleData.points.forEach((pointStyle, index) => {
      const pointStyleHtml = `
        <div class="style-section point-style-section">
          <h3>Point Style ID: ${pointStyle.id}</h3>
          <div class="form-group">
            <label for="iconUrl_${index}">Icon URL:</label>
            <input type="text" id="iconUrl_${index}" value="${pointStyle.iconUrl}" placeholder="URL to icon image">
          </div>
          <div class="form-group">
            <label for="iconScale_${index}">Icon Scale:</label>
            <input type="number" id="iconScale_${index}" value="${pointStyle.iconScale}" min="0.1" max="10" step="0.1" placeholder="Scale">
          </div>
          <div class="form-group">
            <label for="iconHeading_${index}">Icon Heading (degrees):</label>
            <input type="number" id="iconHeading_${index}" value="${pointStyle.iconHeading}" min="0" max="360" placeholder="Heading">
          </div>
          <div class="form-group">
            <label for="iconColor_${index}">Icon Color:</label>
            <input type="color" id="iconColor_${index}" value="${pointStyle.iconColor}">
          </div>
          <div class="form-group">
            <label for="labelEnabled_${index}">Label Enabled:</label>
            <input type="checkbox" id="labelEnabled_${index}" ${pointStyle.labelEnabled ? 'checked' : ''} onchange="toggleLabelControls(${index})">
          </div>
          <div class="form-group label-controls-${index}" style="${!pointStyle.labelEnabled ? 'display:none;' : ''}">
            <label for="labelColor_${index}">Label Color:</label>
            <input type="color" id="labelColor_${index}" value="${pointStyle.labelColor}">
          </div>
          <div class="form-group label-controls-${index}" style="${!pointStyle.labelEnabled ? 'display:none;' : ''}">
            <label for="labelScale_${index}">Label Scale:</label>
            <input type="number" id="labelScale_${index}" value="${pointStyle.labelScale}" min="0.1" max="5" step="0.1" placeholder="Label Scale">
          </div>
        </div>
      `;
      styleControls.innerHTML += pointStyleHtml;
    });
  }
  
  // Generate line style controls
  if (styleData.lines.length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Line Styles</div>';
    
    styleData.lines.forEach((lineStyle, index) => {
      const lineStyleHtml = `
        <div class="style-section line-style-section">
          <h3>Line Style ID: ${lineStyle.id}</h3>
          <div class="form-group">
            <label for="lineColor_${index}">Line Color:</label>
            <input type="color" id="lineColor_${index}" value="${lineStyle.lineColor}">
          </div>
          <div class="form-group">
            <label for="lineOpacity_${index}">Line Opacity:</label>
            <input type="range" id="lineOpacity_${index}" min="0" max="1" step="0.1" value="${lineStyle.lineOpacity}"
                   oninput="document.getElementById('lineOpacityVal_${index}').textContent = this.value">
            <span id="lineOpacityVal_${index}">${lineStyle.lineOpacity}</span>
          </div>
          <div class="form-group">
            <label for="lineWidth_${index}">Line Width:</label>
            <input type="number" id="lineWidth_${index}" value="${lineStyle.lineWidth}" min="1" max="10" placeholder="Line Width">
          </div>
        </div>
      `;
      styleControls.innerHTML += lineStyleHtml;
    });
  }
  
  // Generate polygon style controls
  if (styleData.polygons.length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Polygon Styles</div>';
    
    styleData.polygons.forEach((polyStyle, index) => {
      const polyStyleHtml = `
        <div class="style-section polygon-style-section">
          <h3>Polygon Style ID: ${polyStyle.id}</h3>
          <div class="form-group">
            <label for="fillColor_${index}">Fill Color:</label>
            <input type="color" id="fillColor_${index}" value="${polyStyle.fillColor}">
          </div>
          <div class="form-group">
            <label for="fillOpacity_${index}">Fill Opacity:</label>
            <input type="range" id="fillOpacity_${index}" min="0" max="1" step="0.1" value="${polyStyle.fillOpacity}"
                   oninput="document.getElementById('fillOpacityVal_${index}').textContent = this.value">
            <span id="fillOpacityVal_${index}">${polyStyle.fillOpacity}</span>
          </div>
          <div class="form-group">
            <label for="polyFill_${index}">Fill Enabled:</label>
            <input type="checkbox" id="polyFill_${index}" ${polyStyle.polyFill ? 'checked' : ''}>
          </div>
          <div class="form-group">
            <label for="polyOutline_${index}">Outline Enabled:</label>
            <input type="checkbox" id="polyOutline_${index}" ${polyStyle.polyOutline ? 'checked' : ''} onchange="toggleOutlineControls(${index})">
          </div>
          <div class="form-group outline-controls-${index}" style="${!polyStyle.polyOutline ? 'display:none;' : ''}">
            <label for="polyLineColor_${index}">Outline Color:</label>
            <input type="color" id="polyLineColor_${index}" value="${polyStyle.lineColor}">
          </div>
          <div class="form-group outline-controls-${index}" style="${!polyStyle.polyOutline ? 'display:none;' : ''}">
            <label for="polyLineOpacity_${index}">Outline Opacity:</label>
            <input type="range" id="polyLineOpacity_${index}" min="0" max="1" step="0.1" value="${polyStyle.lineOpacity}"
                   oninput="document.getElementById('polyLineOpacityVal_${index}').textContent = this.value">
            <span id="polyLineOpacityVal_${index}">${polyStyle.lineOpacity}</span>
          </div>
          <div class="form-group outline-controls-${index}" style="${!polyStyle.polyOutline ? 'display:none;' : ''}">
            <label for="polyLineWidth_${index}">Outline Width:</label>
            <input type="number" id="polyLineWidth_${index}" value="${polyStyle.lineWidth}" min="1" max="10" placeholder="Line Width">
          </div>
        </div>
      `;
      styleControls.innerHTML += polyStyleHtml;
    });
  }
  
  // Display StyleMap information if available
  if (Object.keys(styleMapData).length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Style Maps</div>';
    styleControls.innerHTML += '<div class="style-map-info"><p>This KML contains StyleMap elements that link styles together. These relationships will be preserved when exporting.</p></div>';
    
    for (const styleMapId in styleMapData) {
      let styleMapHtml = `
        <div class="style-section style-map-section">
          <h3>StyleMap ID: ${styleMapId}</h3>
          <table class="style-map-table">
            <tr><th>Key</th><th>Style ID</th></tr>
      `;
      
      for (const key in styleMapData[styleMapId]) {
        styleMapHtml += `<tr><td>${key}</td><td>${styleMapData[styleMapId][key]}</td></tr>`;
      }
      
      styleMapHtml += `
          </table>
        </div>
      `;
      
      styleControls.innerHTML += styleMapHtml;
    }
  }
}

// Toggle label controls visibility
function toggleLabelControls(index) {
  const labelEnabled = document.getElementById(`labelEnabled_${index}`).checked;
  const labelControls = document.querySelectorAll(`.label-controls-${index}`);
  
  labelControls.forEach(control => {
    control.style.display = labelEnabled ? 'block' : 'none';
  });
}

// Toggle outline controls visibility
function toggleOutlineControls(index) {
  const outlineEnabled = document.getElementById(`polyOutline_${index}`).checked;
  const outlineControls = document.querySelectorAll(`.outline-controls-${index}`);
  
  outlineControls.forEach(control => {
    control.style.display = outlineEnabled ? 'block' : 'none';
  });
}

// Update feature styles based on values in the control panel.
function updateStyle() {
  // Update styleData from form inputs
  updateStyleDataFromForm();
  
  // Create a style map to store updated styles by ID
  const styleMap = {};
  
  // Add point styles to the map
  styleData.points.forEach(pointStyle => {
    const iconOptions = {
      src: pointStyle.iconUrl,
      scale: pointStyle.iconScale,
      rotation: (pointStyle.iconHeading * Math.PI) / 180,
      color: pointStyle.iconColor
    };
    
    styleMap[pointStyle.id] = function(feature) {
      const styles = [];
      
      // Add icon style
      styles.push(new ol.style.Style({
        image: new ol.style.Icon(iconOptions)
      }));
      
      // Add text style if label is enabled
      if (pointStyle.labelEnabled) {
        styles.push(new ol.style.Style({
          text: new ol.style.Text({
            text: feature.get('name') || '',
            font: `${12 * pointStyle.labelScale}px Arial`,
            fill: new ol.style.Fill({
              color: pointStyle.labelColor
            }),
            stroke: new ol.style.Stroke({
              color: '#ffffff',
              width: 2
            }),
            offsetY: -15
          })
        }));
      }
      
      return styles;
    };
  });
  
  // Add line styles to the map
  styleData.lines.forEach(lineStyle => {
    styleMap[lineStyle.id] = function() {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: hexToRGBA(lineStyle.lineColor, lineStyle.lineOpacity),
          width: lineStyle.lineWidth
        })
      });
    };
  });
  
  // Add polygon styles to the map
  styleData.polygons.forEach(polyStyle => {
    const rgbaFillColor = hexToRGBA(polyStyle.fillColor, polyStyle.fillOpacity);
    const rgbaLineColor = hexToRGBA(polyStyle.lineColor, polyStyle.lineOpacity);
    
    styleMap[polyStyle.id] = function() {
      return new ol.style.Style({
        fill: polyStyle.polyFill ? new ol.style.Fill({ color: rgbaFillColor }) : null,
        stroke: polyStyle.polyOutline ? new ol.style.Stroke({
          color: rgbaLineColor,
          width: polyStyle.lineWidth
        }) : null
      });
    };
  });
  
  // Apply styles to features based on their styleUrl
  vectorSource.getFeatures().forEach(function(feature) {
    let styleUrl = feature.get('styleUrl');
    if (!styleUrl) return; // Skip features without style URL
    
    // Extract the style ID from the styleUrl
    // Handle both '#style-id' and 'file:///path/to/file.html#style-id' formats
    let styleId = styleUrl.split('#').pop();
    
    // Check if this is a StyleMap ID
    if (styleMapData[styleId] && styleMapData[styleId]['normal']) {
      // Use the 'normal' style from the StyleMap
      styleId = styleMapData[styleId]['normal'];
    }
    
    const styleFunction = styleMap[styleId];
    
    if (styleFunction) {
      feature.setStyle(styleFunction);
    }
  });
  
  // Force redraw of the vector layer
  vectorLayer.changed();
  
  // Log to confirm the update is happening
  console.log('Styles updated at:', new Date().toLocaleTimeString());
}

// Update styleData from form inputs
function updateStyleDataFromForm() {
  // Update point styles
  styleData.points.forEach((pointStyle, index) => {
    pointStyle.iconUrl = document.getElementById(`iconUrl_${index}`).value;
    pointStyle.iconScale = parseFloat(document.getElementById(`iconScale_${index}`).value) || 1;
    pointStyle.iconHeading = parseFloat(document.getElementById(`iconHeading_${index}`).value) || 0;
    pointStyle.iconColor = document.getElementById(`iconColor_${index}`).value;
    pointStyle.labelEnabled = document.getElementById(`labelEnabled_${index}`).checked;
    
    if (pointStyle.labelEnabled) {
      pointStyle.labelColor = document.getElementById(`labelColor_${index}`).value;
      pointStyle.labelScale = parseFloat(document.getElementById(`labelScale_${index}`).value) || 1;
    }
  });
  
  // Update line styles
  styleData.lines.forEach((lineStyle, index) => {
    lineStyle.lineColor = document.getElementById(`lineColor_${index}`).value;
    lineStyle.lineOpacity = parseFloat(document.getElementById(`lineOpacity_${index}`).value) || 1;
    lineStyle.lineWidth = parseInt(document.getElementById(`lineWidth_${index}`).value, 10) || 1;
  });
  
  // Update polygon styles
  styleData.polygons.forEach((polyStyle, index) => {
    polyStyle.fillColor = document.getElementById(`fillColor_${index}`).value;
    polyStyle.fillOpacity = parseFloat(document.getElementById(`fillOpacity_${index}`).value) || 1;
    polyStyle.polyFill = document.getElementById(`polyFill_${index}`).checked;
    polyStyle.polyOutline = document.getElementById(`polyOutline_${index}`).checked;
    
    if (polyStyle.polyOutline) {
      polyStyle.lineColor = document.getElementById(`polyLineColor_${index}`).value;
      polyStyle.lineOpacity = parseFloat(document.getElementById(`polyLineOpacity_${index}`).value) || 1;
      polyStyle.lineWidth = parseInt(document.getElementById(`polyLineWidth_${index}`).value, 10) || 1;
    }
  });
}

// Convert hex color to KML color format (aabbggrr)
function colorToKmlColor(hexColor, opacity) {
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert hex to rgb
  const r = hexColor.substr(0, 2);
  const g = hexColor.substr(2, 2);
  const b = hexColor.substr(4, 2);
  
  // Convert opacity to hex
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  
  // Return KML color format (aabbggrr)
  return alpha + b + g + r;
}

// Convert styleData to KML style elements
function styleDataToKml() {
  let kmlStyles = '';
  
  // Process point styles
  styleData.points.forEach(pointStyle => {
    kmlStyles += `
      <Style id="${pointStyle.id}">
        <IconStyle>
          <color>${colorToKmlColor(pointStyle.iconColor, 1)}</color>
          <scale>${pointStyle.iconScale}</scale>
          <heading>${pointStyle.iconHeading}</heading>
          <Icon>
            <href>${pointStyle.iconUrl}</href>
          </Icon>
        </IconStyle>`;
    
    if (pointStyle.labelEnabled) {
      kmlStyles += `
        <LabelStyle>
          <color>${colorToKmlColor(pointStyle.labelColor, 1)}</color>
          <scale>${pointStyle.labelScale}</scale>
        </LabelStyle>`;
    } else {
      kmlStyles += `
        <LabelStyle>
          <scale>0</scale>
        </LabelStyle>`;
    }
    
    kmlStyles += `
      </Style>`;
  });
  
  // Process line styles
  styleData.lines.forEach(lineStyle => {
    kmlStyles += `
      <Style id="${lineStyle.id}">
        <LineStyle>
          <color>${colorToKmlColor(lineStyle.lineColor, lineStyle.lineOpacity)}</color>
          <width>${lineStyle.lineWidth}</width>
        </LineStyle>
      </Style>`;
  });
  
  // Process polygon styles
  styleData.polygons.forEach(polyStyle => {
    kmlStyles += `
      <Style id="${polyStyle.id}">
        <PolyStyle>
          <color>${colorToKmlColor(polyStyle.fillColor, polyStyle.fillOpacity)}</color>
          <fill>${polyStyle.polyFill ? 1 : 0}</fill>
          <outline>${polyStyle.polyOutline ? 1 : 0}</outline>
        </PolyStyle>`;
    
    if (polyStyle.polyOutline) {
      kmlStyles += `
        <LineStyle>
          <color>${colorToKmlColor(polyStyle.lineColor, polyStyle.lineOpacity)}</color>
          <width>${polyStyle.lineWidth}</width>
        </LineStyle>`;
    }
    
    kmlStyles += `
      </Style>`;
  });
  
  return kmlStyles;
}

// Recreate StyleMap elements for the KML export
function recreateStyleMaps() {
  let styleMaps = '';
  
  for (const styleMapId in styleMapData) {
    styleMaps += `
      <StyleMap id="${styleMapId}">`;
    
    for (const key in styleMapData[styleMapId]) {
      styleMaps += `
        <Pair>
          <key>${key}</key>
          <styleUrl>#${styleMapData[styleMapId][key]}</styleUrl>
        </Pair>`;
    }
    
    styleMaps += `
      </StyleMap>`;
  }
  
  return styleMaps;
}

// Export the updated features (with inline styles) as a KML file.
function exportKML() {
  // Update styleData from form inputs
  updateStyleDataFromForm();
  
  // Apply styles to features
  updateStyle();
  
  // Create a new KML document based on the original
  let newKmlDoc = originalKmlDoc.cloneNode(true);
  
  // Find the Document element
  const documentElement = newKmlDoc.getElementsByTagName('Document')[0];
  if (!documentElement) {
    alert('Error: Could not find Document element in KML');
    return;
  }
  
  // Remove all existing Style elements
  const styleElements = documentElement.getElementsByTagName('Style');
  const stylesToRemove = [];
  for (let i = 0; i < styleElements.length; i++) {
    stylesToRemove.push(styleElements[i]);
  }
  
  // Remove the collected Style elements
  stylesToRemove.forEach(element => {
    element.parentNode.removeChild(element);
  });
  
  // Remove all existing StyleMap elements
  const styleMapElements = documentElement.getElementsByTagName('StyleMap');
  const styleMapsToRemove = [];
  for (let i = 0; i < styleMapElements.length; i++) {
    styleMapsToRemove.push(styleMapElements[i]);
  }
  
  // Remove the collected StyleMap elements
  styleMapsToRemove.forEach(element => {
    element.parentNode.removeChild(element);
  });
  
  // Create new style elements
  const styleFragment = new DOMParser().parseFromString(
    `<kml xmlns="http://www.opengis.net/kml/2.2">${styleDataToKml()}</kml>`,
    'text/xml'
  );
  
  // Create new StyleMap elements
  const styleMapFragment = new DOMParser().parseFromString(
    `<kml xmlns="http://www.opengis.net/kml/2.2">${recreateStyleMaps()}</kml>`,
    'text/xml'
  );
  
  // Insert new Style elements at the beginning of the Document
  const newStyleElements = styleFragment.getElementsByTagName('Style');
  for (let i = newStyleElements.length - 1; i >= 0; i--) {
    const importedNode = newKmlDoc.importNode(newStyleElements[i], true);
    if (documentElement.firstChild) {
      documentElement.insertBefore(importedNode, documentElement.firstChild);
    } else {
      documentElement.appendChild(importedNode);
    }
  }
  
  // Insert new StyleMap elements after the Style elements
  const newStyleMapElements = styleMapFragment.getElementsByTagName('StyleMap');
  
  // Find where to insert the StyleMap elements - after all Style elements
  let insertPosition = null;
  const allChildren = documentElement.childNodes;
  let lastStyleIndex = -1;
  
  for (let i = 0; i < allChildren.length; i++) {
    if (allChildren[i].nodeName === 'Style') {
      lastStyleIndex = i;
    }
  }
  
  if (lastStyleIndex >= 0 && lastStyleIndex + 1 < allChildren.length) {
    insertPosition = allChildren[lastStyleIndex + 1];
  }
  
  // Insert the StyleMap elements
  for (let i = 0; i < newStyleMapElements.length; i++) {
    const importedNode = newKmlDoc.importNode(newStyleMapElements[i], true);
    if (insertPosition) {
      documentElement.insertBefore(importedNode, insertPosition);
    } else {
      documentElement.appendChild(importedNode);
    }
  }
  
  // Serialize the updated document to a string
  const serializer = new XMLSerializer();
  const kmlString = serializer.serializeToString(newKmlDoc);
  
  // Create a Blob and trigger a download.
  var blob = new Blob([kmlString], {type: 'application/vnd.google-earth.kml+xml'});
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  
  // Use original filename with _newStyle suffix
  let exportFilename = originalKmlFilename;
  if (!exportFilename || exportFilename === '') {
    exportFilename = 'exported';
  }
  
  // Remove .kml extension if present
  if (exportFilename.toLowerCase().endsWith('.kml')) {
    exportFilename = exportFilename.slice(0, -4);
  }
  
  link.download = exportFilename + '_newStyle.kml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


// Listen for file selections to import a KML file.
document.getElementById('kmlFileInput').addEventListener('change', function(event) {
  var file = event.target.files[0];
  if (file) {
    // Store original filename
    originalKmlFilename = file.name;
    
    var reader = new FileReader();
    reader.onload = function(e) {
      var kmlText = e.target.result;
      
      // Store original KML content
      originalKmlContent = kmlText;
      
      // Populate the control panel with styles from the imported KML.
      readKmlStyles(kmlText);
      
      // Parse the features from the KML text with inline styles.
      var features = new ol.format.KML({
        extractStyles: true
      }).readFeatures(kmlText, {
        featureProjection: 'EPSG:3857'
      });
      
      // Clear any existing features and add the new ones.
      vectorSource.clear();
      vectorSource.addFeatures(features);
      
      // Zoom to the extent of the imported features.
      if (features.length) {
        var extent = vectorSource.getExtent();
        map.getView().fit(extent, { maxZoom: 16, duration: 1000 });
      }
    };
    reader.readAsText(file);
  }
});

// Apply style changes button - update styles immediately when clicked
const applyStyleBtn = document.getElementById('applyStyleBtn');
if (applyStyleBtn) {
  applyStyleBtn.addEventListener('click', function() {
    updateStyle();
  });
}

// Export KML button
const exportKmlBtn = document.getElementById('exportKmlBtn');
if (exportKmlBtn) {
  exportKmlBtn.addEventListener('click', function() {
    exportKML();
  });
}

// Add a real-time style update feature - update styles as they are changed
function setupRealTimeUpdates() {
  const styleControls = document.getElementById('styleControls');
  
  // Use event delegation to handle changes to any input within the style controls
  styleControls.addEventListener('input', function(event) {
    // Only update for certain input types to avoid excessive updates
    if (event.target.type === 'color' || 
        event.target.type === 'range' || 
        event.target.type === 'number') {
      updateStyle();
    }
  });
  
  // Handle checkbox changes separately (change event instead of input)
  styleControls.addEventListener('change', function(event) {
    if (event.target.type === 'checkbox') {
      updateStyle();
    }
  });
}

// Call this after the page loads
document.addEventListener('DOMContentLoaded', function() {
  setupRealTimeUpdates();
});

