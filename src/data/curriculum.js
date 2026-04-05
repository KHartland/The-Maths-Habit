// AQA GCSE Mathematics (8300) Specification - Tier Assignments
// Foundation = Basic Foundation + Additional Foundation content
// Higher = Higher content only (also includes all Foundation content)
export const topics = [
  { id: 'number', name: 'Number', strand: 'Number',
    // N1-N8: Foundation (N7 roots/integer indices, N8 fractions/π)
    // N9: Additional Foundation (standard form)
    // N10: Foundation (terminating decimals), Higher (recurring decimals)
    // N16: Additional Foundation (limits of accuracy), Higher (upper/lower bounds)
    foundation: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16'],
    higher: [] },
  { id: 'algebra', name: 'Algebra', strand: 'Algebra',
    // A1-A5: Foundation (basic manipulation, formulae)
    // A6: Additional Foundation (identities/arguments), Higher (proofs)
    // A7: Foundation (functions), Higher (inverse/composite)
    // A8: Foundation (coordinates all quadrants)
    // A9: Additional Foundation (y=mx+c, parallel), Higher (perpendicular)
    // A10: Foundation (gradients and intercepts)
    // A11: Additional Foundation (quadratics graphically), Higher (completing square)
    // A12: Foundation (linear/quadratic), Additional (cubic/reciprocal), Higher (exponential/trig)
    // A13: Higher only (graph transformations)
    // A14: Foundation (graphs in context)
    // A15: Higher only (gradients of curves, areas under graphs)
    // A16: Higher only (circle equations)
    // A17: Foundation (linear equations)
    // A18: Additional Foundation (factorising quadratics), Higher (completing square/formula)
    // A19: Additional Foundation (simultaneous linear), Higher (linear/quadratic)
    // A20: Higher only (iteration)
    // A21: Additional Foundation (form equations)
    // A22: Additional Foundation (linear inequalities), Higher (quadratic inequalities)
    // A23: Foundation (sequences term-to-term/position-to-term)
    // A24: Foundation (triangular/square/cube/arithmetic), Additional (Fibonacci/quadratic/geometric)
    // A25: Foundation (nth term linear), Higher (nth term quadratic)
    foundation: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A14', 'A17', 'A18', 'A19', 'A21', 'A22', 'A23', 'A24', 'A25'],
    higher: ['A12', 'A13', 'A15', 'A16', 'A20'] },
  { id: 'ratio', name: 'Ratio', strand: 'Ratio',
    // R1-R12: Foundation
    // R13: Additional Foundation (inverse proportion concept), Higher (construct equations)
    // R14: Additional Foundation (gradient as rate of change)
    // R15: Higher only (instantaneous rate of change)
    // R16: Additional Foundation (compound interest), Higher (iterative processes)
    foundation: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R16'],
    higher: ['R15'] },
  { id: 'geometry', name: 'Geometry', strand: 'Geometry',
    // G1-G9: Foundation (G7 fractional SF = Additional, G9 tangent/arc/sector = Additional)
    // G10: Higher only (circle theorems)
    // G11: Foundation (geometrical problems on coordinates)
    // G12: Foundation (properties of 3D shapes)
    // G13: Foundation (plans and elevations)
    // G14-G16: Foundation (measures, bearings, area formulae)
    // G17: Foundation (circle formulae, perimeter, area), Additional (spheres/pyramids/cones)
    // G18: Additional Foundation (arc lengths, sectors)
    // G19: Additional Foundation (similarity lengths), Higher (area/volume ratios)
    // G20: Additional Foundation (Pythagoras/trig 2D), Higher (3D)
    // G21: Additional Foundation (exact trig values)
    // G22-G23: Higher only (sine/cosine rule, area formula)
    // G24: Higher only (vector geometry)
    // G25: Additional Foundation (vector operations), Higher (vector proofs)
    foundation: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16', 'G18', 'G19', 'G20', 'G21', 'G25'],
    higher: ['G10', 'G17', 'G22', 'G23', 'G24'] },
  { id: 'prob', name: 'Probability', strand: 'Probability',
    // P1-P7: Foundation
    // P8: Additional Foundation (independent/dependent events)
    // P9: Higher only (conditional probability)
    foundation: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    higher: ['P9'] },
  { id: 'stats', name: 'Statistics', strand: 'Statistics',
    // S1: Additional Foundation (sampling)
    // S2: Foundation (tables/charts), Additional (time series)
    // S3: Higher only (histograms with unequal class intervals, cumulative frequency)
    // S4: Foundation (averages/range), Higher (box plots, quartiles/IQR)
    // S5: Foundation (statistics to describe population)
    // S6: Foundation (scatter graphs), Additional (line of best fit, predictions)
    foundation: ['S1', 'S2', 'S4', 'S5', 'S6'],
    higher: ['S3'] }
];

export const objectiveDescriptions = {
  // Number (AQA 8300 Section 3.1)
  N1: 'Order positive and negative integers, decimals and fractions; use the symbols =, ≠, <, >, ≤, ≥',
  N2: 'Apply the four operations to integers, decimals and simple fractions, both positive and negative',
  N3: 'Use relationships between operations including inverse operations; use priority of operations (BIDMAS)',
  N4: 'Use the concepts of prime numbers, factors, multiples, common factors, HCF, LCM and prime factorisation',
  N5: 'Apply systematic listing strategies including use of the product rule for counting',
  N6: 'Use positive integer powers and associated real roots (square, cube and higher)',
  N7: 'Calculate with roots and with integer and fractional indices',
  N8: 'Calculate exactly with fractions, surds and multiples of π',
  N9: 'Calculate with and interpret standard form A × 10ⁿ',
  N10: 'Work interchangeably with terminating decimals and their corresponding fractions',
  N11: 'Identify and work with fractions in ratio problems',
  N12: 'Interpret fractions and percentages as operators',
  N13: 'Use standard units of mass, length, time, money and other measures including compound measures',
  N14: 'Estimate answers; check calculations using approximation and estimation',
  N15: 'Round numbers and measures to an appropriate degree of accuracy (decimal places, significant figures)',
  N16: 'Apply and interpret limits of accuracy including upper and lower bounds',

  // Algebra (AQA 8300 Section 3.2)
  A1: 'Use and interpret algebraic notation',
  A2: 'Substitute numerical values into formulae and expressions',
  A3: 'Understand and use the concepts of expressions, equations, formulae, identities, inequalities, terms and factors',
  A4: 'Simplify and manipulate algebraic expressions (collecting like terms, expanding brackets, factorising)',
  A5: 'Understand and use standard mathematical formulae; rearrange formulae to change the subject',
  A6: 'Know the difference between an equation and an identity; use algebra to construct arguments and proofs',
  A7: 'Interpret simple expressions as functions with inputs and outputs; inverse and composite functions',
  A8: 'Work with coordinates in all four quadrants',
  A9: 'Plot graphs of straight lines using y = mx + c; find equations of lines through given points',
  A10: 'Identify and interpret gradients and intercepts of linear functions graphically and algebraically',
  A11: 'Identify and interpret roots, intercepts and turning points of quadratic functions',
  A12: 'Recognise, sketch and interpret graphs of linear, quadratic, cubic, reciprocal and exponential functions',
  A13: 'Sketch translations and reflections of the graph of a given function',
  A14: 'Plot and interpret graphs of non-standard functions in real contexts',
  A15: 'Calculate or estimate gradients of graphs and areas under graphs; interpret results in context',
  A16: 'Recognise and use the equation of a circle with centre at the origin',
  A17: 'Solve linear equations in one unknown algebraically including with brackets and fractions',
  A18: 'Solve quadratic equations by factorising, completing the square and using the quadratic formula',
  A19: 'Solve two simultaneous equations in two variables algebraically',
  A20: 'Find approximate solutions to equations numerically using iteration',
  A21: 'Translate simple situations into algebraic expressions or formulae; derive and solve equations',
  A22: 'Solve linear inequalities in one or two variables; represent the solution set on a number line',
  A23: 'Generate terms of a sequence from a term-to-term or position-to-term rule',
  A24: 'Recognise and use sequences of triangular, square and cube numbers, arithmetic progressions, Fibonacci-type sequences, quadratic sequences and geometric progressions',
  A25: 'Deduce expressions to calculate the nth term of linear and quadratic sequences',

  // Ratio, Proportion and Rates of Change (AQA 8300 Section 3.3)
  R1: 'Change freely between related standard units and compound units (e.g. speed, density, pressure)',
  R2: 'Use scale factors, scale diagrams and maps',
  R3: 'Express one quantity as a fraction of another, where the fraction is less than 1 or greater than 1',
  R4: 'Use ratio notation including reduction to simplest form',
  R5: 'Divide a given quantity into two parts in a given part:part or part:whole ratio',
  R6: 'Express a multiplicative relationship between two quantities as a ratio or a fraction',
  R7: 'Understand and use proportion as equality of ratios',
  R8: 'Relate ratios to fractions and to linear functions',
  R9: 'Define percentage as "number of parts per hundred"; interpret percentages and percentage changes',
  R10: 'Solve problems involving direct and inverse proportion, including graphical and algebraic representations',
  R11: 'Use compound units such as speed, rates of pay, unit pricing, density and pressure',
  R12: 'Compare lengths, areas and volumes using ratio notation and scale factors; make links to similarity',
  R13: 'Understand and construct equations that describe direct and inverse proportion',
  R14: 'Interpret the gradient of a straight-line graph as a rate of change',
  R15: 'Interpret the gradient at a point on a curve as the instantaneous rate of change',
  R16: 'Set up, solve and interpret growth and decay problems, including compound interest',

  // Geometry and Measures (AQA 8300 Section 3.4)
  G1: 'Use conventional terms and notation: points, lines, vertices, edges, parallel lines, perpendicular lines, right angles, polygons, regular polygons',
  G2: 'Use the standard ruler and compass constructions; construct given figures and solve loci problems',
  G3: 'Apply the properties of angles at a point, on a straight line, vertically opposite; use alternate and corresponding angles on parallel lines',
  G4: 'Derive and apply the properties and definitions of special types of quadrilaterals and triangles',
  G5: 'Use the basic congruence criteria for triangles (SSS, SAS, ASA, RHS)',
  G6: 'Apply angle facts, triangle congruence, similarity and properties of quadrilaterals to derive results about angles and sides',
  G7: 'Identify, describe and construct congruent and similar shapes, including on coordinate axes, by considering rotation, reflection, translation and enlargement',
  G8: 'Describe the changes and invariance achieved by combinations of rotations, reflections and translations',
  G9: 'Identify and apply circle definitions and properties, including centre, radius, chord, diameter, circumference, tangent, arc, sector and segment',
  G10: 'Apply and prove the standard circle theorems concerning angles, radii, tangents and chords',
  G11: 'Solve geometrical problems on coordinate axes',
  G12: 'Identify properties of the faces, surfaces, edges and vertices of cubes, cuboids, prisms, cylinders, pyramids, cones and spheres',
  G13: 'Construct and interpret plans and elevations of 3D shapes',
  G14: 'Use standard units of measure and related concepts (length, area, volume/capacity, mass, time, money)',
  G15: 'Measure line segments and angles in geometric figures, including interpreting maps, scale drawings and bearings',
  G16: 'Know and apply formulae to calculate area of triangles, parallelograms, trapezia; volume of cuboids and other right prisms',
  G17: 'Know the formulae: circumference = 2πr = πd, area = πr²; calculate perimeters and areas of circles and composite shapes',
  G18: 'Calculate arc lengths, angles and areas of sectors of circles',
  G19: 'Apply the concepts of congruence and similarity, including the relationships between lengths, areas and volumes in similar figures',
  G20: 'Know the formulae for Pythagoras\' theorem (a² + b² = c²) and the trigonometric ratios; apply them to find angles and lengths in right-angled triangles',
  G21: 'Know the exact values of sin θ and cos θ for θ = 0°, 30°, 45°, 60° and 90°; know exact values of tan θ for θ = 0°, 30°, 45° and 60°',
  G22: 'Know and apply the sine rule and cosine rule to find unknown lengths and angles',
  G23: 'Know and apply Area = ½ab sin C to calculate the area, sides or angles of any triangle',
  G24: 'Describe translations as 2D column vectors',
  G25: 'Apply addition and subtraction of vectors, multiplication of vectors by a scalar; use vectors to construct geometric arguments and proofs',

  // Probability (AQA 8300 Section 3.5)
  P1: 'Record, describe and analyse the frequency of outcomes of probability experiments using tables and frequency trees',
  P2: 'Apply ideas of randomness, fairness and equally likely events to calculate expected outcomes',
  P3: 'Relate relative expected frequencies to theoretical probabilities, using the 0–1 probability scale',
  P4: 'Apply the property that the probabilities of an exhaustive set of mutually exclusive events sum to one',
  P5: 'Use a probability model to predict the outcomes of future experiments',
  P6: 'Enumerate sets and combinations of sets systematically, using tables, grids, Venn diagrams and tree diagrams',
  P7: 'Construct theoretical possibility spaces for single and combined experiments and use these to calculate theoretical probabilities',
  P8: 'Calculate the probability of independent and dependent combined events, including using tree diagrams',
  P9: 'Calculate and interpret conditional probabilities through representation using two-way tables, tree diagrams and Venn diagrams',

  // Statistics (AQA 8300 Section 3.6)
  S1: 'Infer properties of populations or distributions from a sample, whilst knowing the limitations of sampling',
  S2: 'Interpret and construct tables, charts and diagrams including frequency tables, bar charts, pie charts and pictograms',
  S3: 'Construct and interpret diagrams for grouped discrete data and continuous data (histograms, cumulative frequency graphs)',
  S4: 'Interpret, analyse and compare distributions through appropriate measures of central tendency and spread',
  S5: 'Apply statistics to describe a population',
  S6: 'Use and interpret scatter graphs; recognise correlation; draw estimated lines of best fit; interpolate and extrapolate trends'
};

// Revision hints - simple explanations for students when they get questions wrong
export const revisionHints = {
  // Number
  N1: 'Revise ordering: compare decimals digit by digit from left to right. Use place value columns. For fractions, convert to decimals first.',
  N2: 'Revise the rules for calculating with negative numbers: negative × negative = positive, negative × positive = negative. Use column methods for written calculations.',
  N3: 'Revise inverse operations (square ↔ square root, cube ↔ cube root, × ↔ ÷) and BIDMAS: Brackets, Indices, Division/Multiplication, Addition/Subtraction.',
  N4: 'Revise prime numbers (only divisible by 1 and itself), factors (numbers that divide exactly), and prime factor trees for finding HCF and LCM.',
  N5: 'Revise systematic listing: if there are x ways to do task 1 and y ways to do task 2, there are x × y ways to do both.',
  N6: 'Revise powers (e.g. 3² = 9, 2³ = 8) and roots (e.g. √16 = 4, ³√27 = 3). Recognise powers of 2, 3, 4, 5.',
  N7: 'Revise index laws: a^(m/n) = ⁿ√(aᵐ) and a^(-n) = 1/aⁿ. For example, 8^(2/3) = ³√(8²) = ³√64 = 4.',
  N8: 'Revise calculating exactly with fractions (common denominators for +/−, multiply tops and bottoms for ×). Simplify surds: √12 = 2√3.',
  N9: 'Revise standard form: A × 10ⁿ where 1 ≤ A < 10. Large numbers have positive n, small numbers have negative n.',
  N10: 'Revise converting: decimal to fraction (use place value), fraction to decimal (divide top by bottom). For recurring decimals, use algebra.',
  N11: 'Revise writing one quantity as a fraction of another: put the first number on top, the second on the bottom, then simplify.',
  N12: 'Revise finding percentages: 10% = divide by 10, 1% = divide by 100. Build up other percentages from these.',
  N13: 'Revise metric conversions: 1km=1000m, 1m=100cm, 1cm=10mm. For area use squared units, for volume use cubed.',
  N14: 'Revise estimation: round each number to 1 significant figure first, then calculate. Use this to check if your exact answer is reasonable.',
  N15: 'Revise rounding: for decimal places, count digits after the point. For significant figures, count from the first non-zero digit.',
  N16: 'Revise bounds: if a measurement is rounded to the nearest unit, the lower bound is −0.5 and the upper bound is +0.5 from the rounded value.',

  // Algebra
  A1: 'Revise algebra notation: ab means a×b, a² means a×a, 2a means 2×a, a/b means a÷b.',
  A2: 'Revise substitution: replace each letter with its value, then calculate using BIDMAS.',
  A3: 'Revise: an expression has no equals sign, an equation can be solved, a formula shows a relationship, an identity (≡) is true for all values.',
  A4: 'Revise expanding: multiply each term inside the bracket. Factorising: find the common factor and take it outside.',
  A5: 'Revise standard formulae and rearranging: do the same operation to both sides to isolate the new subject.',
  A6: 'Revise: an equation is true for specific values, an identity (≡) is true for all values. For proofs, let n be any integer, 2n is even, 2n+1 is odd.',
  A7: 'Revise function machines: follow operations in order for the output, reverse for the input. fg(x) means do g first, then f.',
  A8: 'Revise coordinates: (x, y) where x is across, y is up. All four quadrants: positive and negative values.',
  A9: 'Revise y = mx + c: m is the gradient (change in y ÷ change in x), c is the y-intercept. Parallel lines have equal gradients.',
  A10: 'Revise gradients: gradient = change in y ÷ change in x. The y-intercept is where the line crosses the y-axis.',
  A11: 'Revise: roots are where the graph crosses the x-axis, the turning point is the maximum or minimum. Complete the square to find the turning point.',
  A12: 'Revise graph shapes: linear = straight line, quadratic = U/∩ shape, cubic = S-shape, reciprocal = two curves, exponential = rapid growth/decay.',
  A13: 'Revise graph transformations: f(x) + a moves up, f(x + a) moves left, −f(x) reflects in x-axis, f(−x) reflects in y-axis.',
  A14: 'Revise reading graphs in context: use the axes labels and units. Substitute values to find approximate solutions.',
  A15: 'Revise: gradient of a curve at a point = gradient of the tangent at that point. Area under a graph can be estimated using triangles and trapezia.',
  A16: 'Revise the equation of a circle centred at the origin: x² + y² = r². A tangent is perpendicular to the radius at the point of contact.',
  A17: 'Revise solving equations: do the same to both sides to get the unknown on its own.',
  A18: 'Revise solving quadratics: factorise and set each bracket = 0. Or use the quadratic formula: x = (−b ± √(b²−4ac)) / 2a.',
  A19: 'Revise simultaneous equations: eliminate one variable by adding/subtracting equations, or use substitution.',
  A20: 'Revise iteration: substitute your answer back into the formula repeatedly until it settles to the required accuracy.',
  A21: 'Revise translating problems into algebra: define variables, set up equations from the information given, solve and check your answer makes sense in context.',
  A22: 'Revise inequality notation: open circle for < or >, closed circle for ≤ or ≥. Solve like equations but reverse the sign when multiplying/dividing by a negative.',
  A23: 'Revise generating sequences: a term-to-term rule tells you how to get from one term to the next. A position-to-term rule gives the nth term directly.',
  A24: 'Revise special sequences: Fibonacci adds previous two terms, geometric multiplies by a constant, triangular numbers are 1, 3, 6, 10, 15...',
  A25: 'Revise nth term: for linear, find the common difference (d), then nth term = dn + (first term − d). For quadratic, find second differences.',

  // Ratio
  R1: 'Revise unit conversions by multiplying or dividing by the conversion factor. For compound units, convert one unit at a time.',
  R2: 'Revise scale factors: new length ÷ original length. On maps, use the scale to convert between map distance and real distance.',
  R3: 'Revise fractions of amounts: divide by the denominator, multiply by the numerator.',
  R4: 'Revise simplifying ratios: divide all parts by their HCF. For 1:n, divide both by the first number.',
  R5: 'Revise sharing in a ratio: add the parts, divide the total by the sum of parts, then multiply by each part.',
  R6: 'Revise: a multiplicative relationship means one quantity is a multiple or fraction of another. Express as a ratio a:b or fraction a/b.',
  R7: 'Revise proportion: if quantities are in proportion, their ratio stays the same. Find the value of 1 unit first, then multiply.',
  R8: 'Revise the link: ratio a:b is the same as the fraction a/b and the equation y = (a/b)x.',
  R9: 'Revise percentages: "per cent" means "per hundred". To find a percentage of an amount, convert to a decimal and multiply.',
  R10: 'Revise direct proportion (y = kx, graph is a straight line through origin) and inverse proportion (y = k/x). Find k first.',
  R11: 'Revise compound units: speed = distance ÷ time, density = mass ÷ volume, pressure = force ÷ area.',
  R12: 'Revise similar shapes: if lengths are in ratio 1:k, areas are 1:k², volumes are 1:k³.',
  R13: 'Revise proportion equations: direct (y = kxⁿ) and inverse (y = k/xⁿ). Substitute known values to find k.',
  R14: 'Revise: the gradient of a straight-line graph represents the rate of change. Steeper = faster rate.',
  R15: 'Revise: the gradient of a tangent to a curve gives the instantaneous rate of change at that point.',
  R16: 'Revise compound interest: multiply by (1 + rate)ⁿ where n is the number of time periods. For decay, multiply by (1 − rate)ⁿ.',

  // Geometry
  G1: 'Revise geometric vocabulary: equilateral (3 equal sides), isosceles (2 equal), scalene (none equal). Know parallel, perpendicular, vertex, edge.',
  G2: 'Revise constructions: use compasses for arcs, keep the same compass width for bisectors. Loci: set of points following a rule.',
  G3: 'Revise angle facts: straight line = 180°, around a point = 360°, vertically opposite are equal. Alternate (Z) angles are equal, corresponding (F) angles are equal.',
  G4: 'Revise quadrilateral properties: parallelogram (opposite sides parallel and equal), rhombus (4 equal sides), trapezium (one pair parallel).',
  G5: 'Revise congruence conditions: SSS, SAS, ASA, RHS. Two triangles are congruent if they satisfy any of these.',
  G6: 'Revise using angle facts and congruence/similarity to prove results. Base angles of an isosceles triangle are equal.',
  G7: 'Revise congruent (same size and shape) vs similar (same shape, different size). Identify transformations: rotation, reflection, translation, enlargement.',
  G8: 'Revise combined transformations: describe each transformation in turn. Use column vectors for translations.',
  G9: 'Revise circle parts: radius (centre to edge), diameter (across through centre), chord (line across), tangent (touches at one point), arc (part of circumference), sector (pizza slice), segment (chord cuts off).',
  G10: 'Revise circle theorems: angle in semicircle = 90°, tangent meets radius at 90°, angles in same segment are equal, opposite angles in cyclic quadrilateral sum to 180°.',
  G11: 'Revise coordinate geometry: use coordinates to find midpoints, distances, and gradients. Apply algebraic methods to geometric problems.',
  G12: 'Revise 3D shapes: know the names, number of faces, edges and vertices of cubes, cuboids, prisms, cylinders, pyramids, cones and spheres.',
  G13: 'Revise plans and elevations: plan = view from above, front elevation = view from front, side elevation = view from side.',
  G14: 'Revise standard units: length (mm, cm, m, km), area (cm², m²), volume (cm³, m³, litres), mass (g, kg), time (s, min, hr).',
  G15: 'Revise measuring angles with a protractor. For bearings: measure clockwise from North, always give 3 figures (e.g. 045°).',
  G16: 'Revise area formulae: rectangle = l×w, triangle = ½×b×h, parallelogram = b×h, trapezium = ½(a+b)×h. Volume of prism = area of cross-section × length.',
  G17: 'Revise circle formulae: circumference = πd or 2πr, area = πr². Volume of cylinder = πr²h. Leave answers in terms of π if asked.',
  G18: 'Revise arc length = (θ/360) × 2πr. Sector area = (θ/360) × πr². θ is the angle of the sector.',
  G19: 'Revise similarity: if shapes are similar, corresponding lengths are in the same ratio. Area ratio = k², volume ratio = k³.',
  G20: 'Revise Pythagoras: a² + b² = c² (c is the hypotenuse). SOHCAHTOA: sin = opp/hyp, cos = adj/hyp, tan = opp/adj.',
  G21: 'Revise exact values: sin30°=½, cos30°=√3/2, tan30°=1/√3, sin45°=cos45°=1/√2, tan45°=1, sin60°=√3/2, cos60°=½, tan60°=√3.',
  G22: 'Revise sine rule: a/sinA = b/sinB. Cosine rule: a² = b² + c² − 2bc×cosA. Use these for non-right-angled triangles.',
  G23: 'Revise triangle area = ½ × a × b × sin(C) where C is the angle between sides a and b.',
  G24: 'Revise column vectors: (x, y) means x right and y up. A negative value means the opposite direction.',
  G25: 'Revise vector operations: add by adding components, scalar multiplication multiplies each component. Parallel vectors are multiples of each other.',

  // Probability
  P1: 'Revise recording outcomes: use tables and frequency trees to organise experimental results systematically.',
  P2: 'Revise theoretical probability = number of favourable outcomes ÷ total number of equally likely outcomes.',
  P3: 'Revise relative frequency = number of successes ÷ number of trials. As trials increase, relative frequency approaches theoretical probability.',
  P4: 'Revise: P(event happens) + P(event doesn\'t happen) = 1. All mutually exclusive probabilities sum to 1.',
  P5: 'Revise probability models: use theoretical probabilities to predict expected outcomes. More trials = closer to expected results.',
  P6: 'Revise Venn diagrams and tree diagrams: use them to list all possible outcomes systematically.',
  P7: 'Revise sample spaces: list all possible outcomes for combined events using tables or grids. Count favourable outcomes ÷ total outcomes.',
  P8: 'Revise combined events: multiply along branches for AND (both events), add between branches for OR (either event).',
  P9: 'Revise conditional probability: without replacement changes the denominator for the second pick. Use two-way tables or tree diagrams.',

  // Statistics
  S1: 'Revise sampling: a good sample should be representative of the population. Know the limitations — a sample may not reflect the whole population.',
  S2: 'Revise reading charts carefully: check the scale, labels and units. Bar charts for categories, pictograms use symbols, line graphs for time series.',
  S3: 'Revise pie charts: angle = (frequency ÷ total) × 360°. For histograms: frequency density = frequency ÷ class width.',
  S4: 'Revise averages: mean = total ÷ count, median = middle value, mode = most common. Spread: range = highest − lowest, IQR = Q3 − Q1.',
  S5: 'Revise using statistics to describe populations: compare averages and spreads to draw conclusions.',
  S6: 'Revise scatter graphs: positive correlation = both increase, negative = one increases as other decreases. Correlation does not mean causation.'
};

export const levelLabels = ['Not started', '1/5 done', '2/5 done', '3/5 done', '4/5 nearly there!', '⭐ Mastered'];

export const TOPIC_HEX = {
  Number: "#513A6F",      // Deep purple
  Algebra: "#2F4858",     // Cool teal
  Ratio: "#A845A2",       // Magenta
  Geometry: "#31456A",    // Secondary blue
  Probability: "#76235E", // Accent magenta
  Statistics: "#8E0039",  // Accent crimson
};

// Heatmap mastery palette: cool to warm to gold
export const HEATMAP_COLORS = {
  0: '#1a1525',   // Near-dark (unpracticed)
  1: '#2F4858',   // Cool teal
  2: '#513A6F',   // Deep purple
  3: '#A845A2',   // Magenta
  4: '#B00053',   // Crimson
  5: '#D4AF37',   // Gold (mastery - sacred)
};

// Tile image assets for the heatmap — stone, gems, and gold
export const TILE_IMAGES = {
  0: '/images/tiles/stone-tile.jpeg',     // Grey stone (not started)
  1: '/images/tiles/teal-gem.jpeg',       // Teal gem (started)
  2: '/images/tiles/purple-gem.jpeg',     // Purple gem (learning)
  3: '/images/tiles/magenta-jem.jpeg',    // Magenta gem (confident)
  4: '/images/tiles/crimson-gem.jpeg',    // Crimson gem (exam ready)
  5: '/images/tiles/gold-tile.jpeg',      // Gold pi tile (mastered)
};
